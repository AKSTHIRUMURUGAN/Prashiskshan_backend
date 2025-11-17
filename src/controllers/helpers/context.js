import { randomUUID } from "node:crypto";
import Student from "../../models/Student.js";
import Mentor from "../../models/Mentor.js";
import Admin from "../../models/Admin.js";
import Company from "../../models/Company.js";
import { verifyToken } from "../../config/firebase.js";

export const createHttpError = (status, message, details = undefined) => {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
};

export const generateId = (prefix) => `${prefix}-${randomUUID().split("-")[0].toUpperCase()}`;

export const findUserByFirebaseUid = async (firebaseUid) => {
  if (!firebaseUid) return null;
  const [student, mentor, admin, company] = await Promise.all([
    Student.findOne({ firebaseUid }),
    Mentor.findOne({ firebaseUid }),
    Admin.findOne({ firebaseUid }),
    Company.findOne({ firebaseUid }),
  ]);

  if (student) return { role: "student", doc: student };
  if (mentor) return { role: "mentor", doc: mentor };
  if (admin) return { role: "admin", doc: admin };
  if (company) return { role: "company", doc: company };
  return null;
};

export const resolveUserFromRequest = async (req) => {
  if (req.user && req.user.firebaseUid) {
    const context = await findUserByFirebaseUid(req.user.firebaseUid);
    if (context) return context;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw createHttpError(401, "Authentication token required");
  }
  const decoded = await verifyToken(token);
  const context = await findUserByFirebaseUid(decoded.uid);
  if (!context) {
    throw createHttpError(404, "Profile not found for authenticated user");
  }
  return context;
};

export const sanitizeDoc = (doc, role) => {
  if (!doc) return null;
  const data = doc.toObject({ getters: true });
  delete data.firebaseUid;
  delete data.__v;
  return { role, ...data };
};

