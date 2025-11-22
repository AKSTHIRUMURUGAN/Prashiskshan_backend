import { verifyToken } from "../config/firebase.js";
import Student from "../models/Student.js";
import Mentor from "../models/Mentor.js";
import Admin from "../models/Admin.js";
import Company from "../models/Company.js";
import { logger } from "../utils/logger.js";

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

export const authenticate = async (req, res, next) => {
  try {
    let header = req.headers.authorization || "";
    // If Authorization header is missing, check for an `id_token` cookie and use it
    if (!header || !header.startsWith("Bearer ")) {
      const cookieHeader = req.headers.cookie || "";
      const match = cookieHeader.match(/(?:^|; )id_token=([^;]+)/);
      if (match && match[1]) {
        const cookieToken = decodeURIComponent(match[1]);
        header = `Bearer ${cookieToken}`;
        // set a synthetic header so downstream code can see it if necessary
        req.headers.authorization = header;
      }
    }

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authorization header missing or malformed" });
    }
    const token = header.slice(7);
    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch (error) {
      logger.error("Token verification failed", { error: error.message });
      return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    req.firebase = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const identifyUser = async (req, res, next) => {
  try {
    const uid = req.firebase?.uid;
    if (!uid) {
      return next(createError(401, "Unauthenticated"));
    }

    const [student, mentor, admin, company] = await Promise.all([
      Student.findOne({ firebaseUid: uid }),
      Mentor.findOne({ firebaseUid: uid }),
      Admin.findOne({ firebaseUid: uid }),
      Company.findOne({ firebaseUid: uid }),
    ]);

    if (student) {
      req.user = {
        role: "student",
        studentId: student.studentId,
        mongoId: student._id,
      };
    } else if (mentor) {
      req.user = {
        role: "mentor",
        mentorId: mentor.mentorId,
        mongoId: mentor._id,
        department: mentor.profile.department,
      };
    } else if (admin) {
      req.user = {
        role: "admin",
        adminId: admin.adminId,
        mongoId: admin._id,
      };
    } else if (company) {
      req.user = {
        role: "company",
        companyId: company.companyId,
        mongoId: company._id,
        status: company.status,
      };
    } else {
      return next(createError(404, "User profile not found"));
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles) => (req, res, next) => {
  const actualRole = req.user?.role;
  if (!actualRole) {
    return res.status(401).json({ success: false, error: "Unauthenticated" });
  }
  if (!allowedRoles.includes(actualRole)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      details: `Required roles: [${allowedRoles.join(", ")}], but you are: ${actualRole}`,
    });
  }
  return next();
};

export const checkOwnership = (resourceResolver) => async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!role) {
      return next(createError(401, "Unauthenticated"));
    }
    if (!resourceResolver) {
      return next();
    }

    const resource = await resourceResolver(req);
    if (!resource) {
      return next(createError(404, "Resource not found"));
    }

    let allowed = false;
    if (role === "admin") {
      allowed = true;
    } else if (role === "student" && resource.studentId && String(resource.studentId) === String(req.user.mongoId)) {
      allowed = true;
    } else if (role === "mentor" && resource.department && resource.department === req.user.department) {
      allowed = true;
    } else if (role === "company" && resource.companyId && String(resource.companyId) === String(req.user.mongoId)) {
      allowed = true;
    }

    if (!allowed) {
      return next(createError(403, "You do not have permission to access this resource"));
    }

    req.resource = resource;
    return next();
  } catch (error) {
    next(error);
  }
};

