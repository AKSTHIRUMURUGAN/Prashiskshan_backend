import Student from "../models/Student.js";
import Company from "../models/Company.js";
import Mentor from "../models/Mentor.js";
import Admin from "../models/Admin.js";
import { firebaseAdmin, verifyToken } from "../config/firebase.js";
import imagekitClient from "../config/imagekit.js";
import { emailService } from "../services/emailService.js";
import { storageService } from "../services/storageService.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import { createHttpError, generateId, findUserByFirebaseUid, resolveUserFromRequest, sanitizeDoc } from "./helpers/context.js";

const emailExists = async (email) => {
  const [student, mentor, admin, company] = await Promise.all([
    Student.findOne({ email }).lean(),
    Mentor.findOne({ email }).lean(),
    Admin.findOne({ email }).lean(),
    Company.findOne({ email }).lean(),
  ]);
  return Boolean(student || mentor || admin || company);
};

export const registerStudent = async (req, res, next) => {
  try {
    const { email, password, profile = {}, phone, preferences } = req.body;

    if (!email || !password) throw createHttpError(400, "Email and password are required");
    const requiredProfileFields = ["name", "department", "year", "college"];
    const missingFields = requiredProfileFields.filter((field) => !profile[field]);
    if (missingFields.length) {
      throw createHttpError(400, `Missing profile fields: ${missingFields.join(", ")}`);
    }

    const exists = await emailExists(email);
    if (exists) throw createHttpError(409, "Email already registered");

    let firebaseUser;
    try {
      firebaseUser = await firebaseAdmin.auth().createUser({
        email,
        password,
        displayName: profile.name,
      });
    } catch (error) {
      logger.error("Firebase user creation failed", error);
      throw createHttpError(502, "Unable to create Firebase user");
    }

    try {
      const student = new Student({
        studentId: generateId("STD"),
        firebaseUid: firebaseUser.uid,
        email,
        profile: {
          ...profile,
          phone: phone || profile.phone,
        },
        preferences: preferences || undefined,
      });
      student.calculateReadinessScore();
      await student.save();

      await emailService.sendWelcomeStudent({ email, name: profile.name });

      res.status(201).json(apiSuccess({ student: sanitizeDoc(student, "student") }, "Student registered successfully"));
    } catch (error) {
      await firebaseAdmin.auth().deleteUser(firebaseUser.uid);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const registerCompany = async (req, res, next) => {
  try {
    const { email, password, companyName, website, phone, address, documents = {}, pointOfContact = {} } = req.body;
    if (!email || !password || !companyName || !website || !phone || !address) {
      throw createHttpError(400, "Missing required company fields");
    }
    if (!documents.cinNumber) {
      throw createHttpError(400, "CIN number is required for registration");
    }
    if (!pointOfContact.name || !pointOfContact.email || !pointOfContact.phone) {
      throw createHttpError(400, "Point of contact details are incomplete");
    }

    const exists = await emailExists(email);
    if (exists) throw createHttpError(409, "Email already registered");

    let firebaseUser;
    try {
      firebaseUser = await firebaseAdmin.auth().createUser({
        email,
        password,
        displayName: companyName,
      });
    } catch (error) {
      logger.error("Firebase company creation failed", error);
      throw createHttpError(502, "Unable to create Firebase user");
    }

    try {
      const company = await Company.create({
        companyId: generateId("COM"),
        firebaseUid: firebaseUser.uid,
        companyName,
        website,
        email,
        phone,
        address,
        documents,
        pointOfContact,
      });

      res.status(201).json(apiSuccess({ company: sanitizeDoc(company, "company") }, "Company registered successfully"));
    } catch (error) {
      await firebaseAdmin.auth().deleteUser(firebaseUser.uid);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) throw createHttpError(400, "idToken is required");

    const decoded = await verifyToken(idToken);
    const context = await findUserByFirebaseUid(decoded.uid);
    if (!context) throw createHttpError(404, "User profile not found");

    context.doc.lastLoginAt = new Date();
    await context.doc.save();

    res.json(apiSuccess({ user: sanitizeDoc(context.doc, context.role) }, "Login successful"));
  } catch (error) {
    next(error);
  }
};

export const refreshProfile = async (req, res, next) => {
  try {
    const context = await resolveUserFromRequest(req);
    if (context.role === "student") {
      context.doc.calculateReadinessScore();
      await context.doc.save();
    }
    res.json(apiSuccess({ user: sanitizeDoc(context.doc, context.role) }, "Profile refreshed"));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const context = await resolveUserFromRequest(req);
    const updates = req.body || {};

    let updatedDoc;
    if (context.role === "student") {
      const allowedProfileFields = ["name", "department", "year", "college", "rollNumber", "phone", "bio", "skills", "interests", "resume", "profileImage"];
      const profileUpdates = {};
      allowedProfileFields.forEach((field) => {
        if (updates.profile && updates.profile[field] !== undefined) {
          profileUpdates[`profile.${field}`] = updates.profile[field];
        }
      });
      if (updates.preferences) {
        Object.keys(updates.preferences).forEach((key) => {
          profileUpdates[`preferences.${key}`] = updates.preferences[key];
        });
      }
      updatedDoc = await Student.findByIdAndUpdate(context.doc._id, { $set: profileUpdates }, { new: true });
      updatedDoc.calculateReadinessScore();
      await updatedDoc.save();
    } else if (context.role === "company") {
      const allowedFields = ["phone", "address", "pointOfContact", "website"];
      const set = {};
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) set[field] = updates[field];
      });
      updatedDoc = await Company.findByIdAndUpdate(context.doc._id, { $set: set }, { new: true });
    } else if (context.role === "mentor") {
      const allowedFields = ["profile.phone", "profile.bio", "profile.expertiseAreas"];
      const set = {};
      allowedFields.forEach((path) => {
        const [root, sub] = path.split(".");
        if (updates[root] && updates[root][sub] !== undefined) {
          set[path] = updates[root][sub];
        }
      });
      updatedDoc = await Mentor.findByIdAndUpdate(context.doc._id, { $set: set }, { new: true });
    } else {
      throw createHttpError(403, "Admins manage profiles via admin console");
    }

    res.json(apiSuccess({ user: sanitizeDoc(updatedDoc, context.role) }, "Profile updated"));
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { idToken, newPassword } = req.body;
    if (!idToken || !newPassword) throw createHttpError(400, "idToken and newPassword are required");

    const decoded = await verifyToken(idToken);
    await firebaseAdmin.auth().updateUser(decoded.uid, { password: newPassword });
    res.json(apiSuccess({}, "Password updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) throw createHttpError(400, "Profile image file is required");
    const context = await resolveUserFromRequest(req);
    const fileName = `profile-${context.doc._id}-${Date.now()}`;

    const uploadResponse = await imagekitClient.upload({
      file: req.file.buffer.toString("base64"),
      fileName,
      folder: "/profiles",
      useUniqueFileName: true,
    });

    if (context.role === "student") {
      await Student.findByIdAndUpdate(context.doc._id, { "profile.profileImage": uploadResponse.url });
    } else if (context.role === "company") {
      await Company.findByIdAndUpdate(context.doc._id, { logoUrl: uploadResponse.url });
    } else if (context.role === "mentor") {
      await Mentor.findByIdAndUpdate(context.doc._id, { "profile.avatar": uploadResponse.url });
    }

    res.json(apiSuccess({ imageUrl: uploadResponse.url }, "Profile image updated"));
  } catch (error) {
    next(error);
  }
};

export const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) throw createHttpError(400, "Resume file is required");
    if (req.file.mimetype !== "application/pdf") throw createHttpError(400, "Resume must be a PDF");
    const context = await resolveUserFromRequest(req);
    if (context.role !== "student") throw createHttpError(403, "Only students can upload resumes");

    const uploadResult = await storageService.uploadFile(req.file.buffer, {
      filename: `resume-${context.doc.studentId}.pdf`,
      contentType: req.file.mimetype,
      provider: "s3",
    });

    const student = await Student.findByIdAndUpdate(
      context.doc._id,
      {
        "profile.resume": uploadResult.url,
      },
      { new: true },
    );

    res.json(apiSuccess({ resumeUrl: uploadResult.url, student: sanitizeDoc(student, "student") }, "Resume uploaded"));
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const context = await resolveUserFromRequest(req);
    context.doc.status = "deleted";
    if (context.role === "student") {
      context.doc.preferences = context.doc.preferences || {};
      context.doc.preferences.notificationChannels = {
        email: false,
        sms: false,
        whatsapp: false,
        realtime: false,
      };
    }
    await context.doc.save();
    await firebaseAdmin.auth().updateUser(context.doc.firebaseUid, { disabled: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


