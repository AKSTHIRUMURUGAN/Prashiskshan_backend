import Student from "../models/Student.js";
import Company from "../models/Company.js";
import Mentor from "../models/Mentor.js";
import Admin from "../models/Admin.js";
import { firebaseAdmin, verifyToken } from "../config/firebase.js";
import fetch from "node-fetch";
import config from "../config/index.js";
import imagekitClient from "../config/imagekit.js";
import { emailService } from "../services/emailService.js";
import { storageService } from "../services/storageService.js";
import { analyticsService } from "../services/analyticsService.js";
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
      // Provide clearer guidance for common Firebase configuration errors
      const code = error && (error.code || (error.errorInfo && error.errorInfo.code));
      if (code === "auth/configuration-not-found") {
        throw createHttpError(
          502,
          "Unable to create Firebase user: Email/Password provider not configured. Enable Email/Password sign-in in the Firebase Console or use the Firebase Auth emulator (set FIREBASE_AUTH_EMULATOR_HOST).",
        );
      }
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

      // Create a Firebase custom token so the client can exchange it for an ID token.
      // We store the token in a secure, httpOnly cookie for convenient client-side exchange.
      try {
        const customToken = await firebaseAdmin.auth().createCustomToken(firebaseUser.uid);
        const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 };
        res.cookie("auth_token", customToken, cookieOpts);
        logger.info("Set auth_token cookie for newly registered student", { uid: firebaseUser.uid });
      } catch (tokenErr) {
        logger.warn("Failed to create Firebase custom token", { error: tokenErr.message });
      }

      // Send welcome email but do not let email failures block registration.
      // Run in background and log any errors.
      emailService
        .sendWelcomeStudent({ email, name: profile.name })
        .catch((emailError) => {
          logger.error("Welcome email failed", { error: emailError.message });
        });

      // Send email verification link (non-blocking). Uses Firebase Admin to generate a link.
      (async () => {
        try {
          const actionCodeSettings = { url: `${config.app.frontendUrl}/auth/verify?uid=${firebaseUser.uid}`, handleCodeInApp: true };
          const link = await firebaseAdmin.auth().generateEmailVerificationLink(email, actionCodeSettings);
          await emailService.sendEmail({ to: email, subject: "Verify your email", html: `<p>Hi ${profile.name}, please verify your email by clicking <a href=\"${link}\">here</a>.</p>` });
          logger.info("Sent verification email after registration", { email });
        } catch (err) {
          logger.warn("Failed to send verification email after registration", { error: err && err.message });
        }
      })();

      // Log analytics event (non-blocking)
      analyticsService
        .logEvent({ clientId: firebaseUser.uid, name: "sign_up", params: { method: "email" } })
        .catch(() => {});

      res.status(201).json(
        apiSuccess({ student: sanitizeDoc(student, "student"), firebaseUid: firebaseUser.uid }, "Student registered successfully"),
      );
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
      const code = error && (error.code || (error.errorInfo && error.errorInfo.code));
      if (code === "auth/configuration-not-found") {
        throw createHttpError(
          502,
          "Unable to create Firebase user: Email/Password provider not configured. Enable Email/Password sign-in in the Firebase Console or use the Firebase Auth emulator (set FIREBASE_AUTH_EMULATOR_HOST).",
        );
      }
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

      // Create a Firebase custom token and set it as a cookie for client exchange
      try {
        const customToken = await firebaseAdmin.auth().createCustomToken(firebaseUser.uid);
        const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 };
        res.cookie("auth_token", customToken, cookieOpts);
        logger.info("Set auth_token cookie for newly registered company", { uid: firebaseUser.uid });
      } catch (tokenErr) {
        logger.warn("Failed to create Firebase custom token for company", { error: tokenErr.message });
      }

      // Send email verification link for company registration (non-blocking)
      (async () => {
        try {
          const actionCodeSettings = { url: `${config.app.frontendUrl}/auth/verify?uid=${firebaseUser.uid}`, handleCodeInApp: true };
          const link = await firebaseAdmin.auth().generateEmailVerificationLink(email, actionCodeSettings);
          await emailService.sendEmail({ to: email, subject: "Verify your company account", html: `<p>Please verify your company account by clicking <a href=\"${link}\">here</a>.</p>` });
          logger.info("Sent verification email after company registration", { email });
        } catch (err) {
          logger.warn("Failed to send verification email after company registration", { error: err && err.message });
        }
      })();

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
    const { idToken, firebaseUid, email, password } = req.body;
    if (!idToken && !firebaseUid && !(email && password)) throw createHttpError(400, "idToken or firebaseUid or email+password is required");

    let decoded;
    let usedIdToken = idToken;

    // If email+password provided, exchange via Identity Toolkit REST for an ID token
    if (!usedIdToken && email && password) {
      const apiKey = process.env.FIREBASE_WEB_API_KEY || (config && config.firebase && config.firebase.webApiKey);
      if (!apiKey) throw createHttpError(500, "Server misconfiguration: FIREBASE_WEB_API_KEY is required for email/password login");
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        const msg = (body && body.error && body.error.message) || JSON.stringify(body);
        throw createHttpError(401, `Authentication failed: ${msg}`);
      }
      usedIdToken = body.idToken;
    }

    if (usedIdToken) {
      decoded = await verifyToken(usedIdToken);
    } else {
      // Development-only fallback: allow logging in by firebaseUid when not in production
      const allowUidLogin = process.env.NODE_ENV !== "production" || process.env.ALLOW_UID_LOGIN === "true";
      if (!allowUidLogin) {
        throw createHttpError(403, "Logging in by firebaseUid is disabled in production");
      }
      logger.warn("Development login by firebaseUid used. Do NOT enable this in production.", { firebaseUid });
      decoded = { uid: firebaseUid };
    }
    // Enforce email verification for production flows unless explicitly allowed by env.
    const allowUnverified = process.env.ALLOW_UNVERIFIED_LOGIN === "true";
    if (!allowUnverified) {
      try {
        const firebaseUserRecord = await firebaseAdmin.auth().getUser(decoded.uid);
        if (!firebaseUserRecord.emailVerified) {
          throw createHttpError(403, "Email not verified. Please verify your email before logging in.");
        }
      } catch (err) {
        // If Firebase user not found, surface as 404; otherwise rethrow
        const code = err && (err.code || (err.errorInfo && err.errorInfo.code));
        if (code === "auth/user-not-found") {
          throw createHttpError(404, "User not found in Firebase");
        }
        throw err;
      }
    }
    const context = await findUserByFirebaseUid(decoded.uid);
    if (!context) throw createHttpError(404, "User profile not found");

    context.doc.lastLoginAt = new Date();
    await context.doc.save();

    // Set the ID token in an httpOnly cookie so the browser can send it automatically.
    // If the server obtained an ID token (from client or via email/password exchange), set it.
    if (usedIdToken) {
      try {
        // Try to decode the JWT to get expiry and set cookie accordingly
        let maxAge = 60 * 60 * 1000; // default 1 hour
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            if (payload && payload.exp) {
              const expiresAt = payload.exp * 1000;
              const remaining = expiresAt - Date.now();
              if (remaining > 0) maxAge = remaining;
            }
          }
        } catch (e) {
          // ignore decode errors and fall back to default maxAge
        }

        const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge };
        res.cookie("id_token", usedIdToken, cookieOpts);
        logger.info("Set id_token cookie after login", { uid: decoded.uid });
      } catch (cookieErr) {
        logger.warn("Failed to set id_token cookie", { error: cookieErr.message });
      }
    }

    res.json(apiSuccess({ user: sanitizeDoc(context.doc, context.role) }, "Login successful"));
    // Log analytics event for login (best-effort, non-blocking)
    analyticsService.logEvent({ clientId: decoded.uid, name: "login", params: { method: usedIdToken ? "id_token" : "uid" } }).catch(() => {});
  } catch (error) {
    next(error);
  }
};

export const sendVerificationEmail = async (req, res, next) => {
  try {
    const context = await resolveUserFromRequest(req);
    if (!context || !context.doc || !context.doc.email) throw createHttpError(400, "User email not found");
    const email = context.doc.email;
    const actionCodeSettings = {
      url: `${config.app.frontendUrl}/auth/verify?uid=${context.doc.firebaseUid}`,
      handleCodeInApp: true,
    };
    const link = await firebaseAdmin.auth().generateEmailVerificationLink(email, actionCodeSettings);
    await emailService.sendEmail({ to: email, subject: "Verify your email", html: `<p>Please verify your email by clicking <a href=\"${link}\">here</a>.</p>` });
    res.json(apiSuccess({}, "Verification email sent"));
  } catch (err) {
    next(err);
  }
};

export const sendPasswordResetEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw createHttpError(400, "Email is required");
    const actionCodeSettings = {
      url: `${config.app.frontendUrl}/auth/reset-password`,
      handleCodeInApp: true,
    };
    const link = await firebaseAdmin.auth().generatePasswordResetLink(email, actionCodeSettings);
    await emailService.sendEmail({ to: email, subject: "Reset your password", html: `<p>Reset password by clicking <a href=\"${link}\">here</a>.</p>` });
    res.json(apiSuccess({}, "Password reset email sent"));
  } catch (err) {
    next(err);
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

// POST /api/auth/exchange-cookie
// Exchanges a server-issued custom token (cookie `auth_token`) for an ID token via
// Firebase Identity Toolkit REST API. Requires `FIREBASE_WEB_API_KEY` in env.
export const exchangeCookieToken = async (req, res, next) => {
  try {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(/(?:^|; )auth_token=([^;]+)/);
    const provided = req.body && req.body.customToken;
    const customToken = provided || (match && decodeURIComponent(match[1]));
    if (!customToken) return res.status(400).json({ success: false, error: "No custom token provided in cookie or body" });

    const apiKey = process.env.FIREBASE_WEB_API_KEY || config.firebase.webApiKey;
    if (!apiKey) return res.status(500).json({ success: false, error: "FIREBASE_WEB_API_KEY not configured on server" });

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    const body = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ success: false, error: body.error || body });
    }

    // body contains idToken, refreshToken, expiresIn (seconds)
    const idToken = body.idToken;
    const expiresIn = parseInt(body.expiresIn || "3600", 10) * 1000;
    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: expiresIn };
    res.cookie("id_token", idToken, cookieOpts);

    // Optionally clear the auth_token cookie since we've exchanged it
    res.clearCookie("auth_token");

    return res.json({ success: true, idToken, expiresIn });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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


