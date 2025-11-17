import mongoose from "mongoose";
import Student from "../models/Student.js";
import Mentor from "../models/Mentor.js";
import Company from "../models/Company.js";
import Internship from "../models/Internship.js";
import Application from "../models/Application.js";
import Logbook from "../models/Logbook.js";
import Report from "../models/Report.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { createHttpError, resolveUserFromRequest } from "./helpers/context.js";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const importJobs = new Map();

const ensureAdminContext = async (req) => {
  const context = await resolveUserFromRequest(req);
  if (context.role !== "admin" && context.role !== "super_admin") {
    throw createHttpError(403, "Admin privileges required");
  }
  return context.doc;
};

export const getAdminDashboard = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const [studentCount, mentorCount, companyCount, internshipCount, applicationCount, logbookPending] = await Promise.all([
      Student.countDocuments(),
      Mentor.countDocuments(),
      Company.countDocuments(),
      Internship.countDocuments({ status: "approved" }),
      Application.countDocuments(),
      Logbook.countDocuments({ status: { $in: ["submitted", "pending_mentor_review", "pending_company_review"] } }),
    ]);

    res.json(
      apiSuccess(
        {
          totals: {
            students: studentCount,
            mentors: mentorCount,
            companies: companyCount,
            internships: internshipCount,
            applications: applicationCount,
          },
          pendingLogbooks: logbookPending,
        },
        "Admin dashboard",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPendingCompanies = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { riskLevel } = req.query;
    const query = { status: "pending_verification" };
    if (riskLevel) query["aiVerification.riskLevel"] = riskLevel;
    const companies = await Company.find(query).sort({ createdAt: -1 }).lean();
    res.json(apiSuccess(companies, "Pending companies"));
  } catch (error) {
    next(error);
  }
};

export const getCompanyDetails = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { companyId } = req.params;
    const company = await Company.findOne({ companyId }).lean();
    if (!company) throw createHttpError(404, "Company not found");
    res.json(apiSuccess(company, "Company details"));
  } catch (error) {
    next(error);
  }
};

export const verifyCompany = async (req, res, next) => {
  try {
    const admin = await ensureAdminContext(req);
    const { companyId } = req.params;
    const { comments } = req.body;

    const company = await Company.findOneAndUpdate(
      { companyId },
      {
        status: "verified",
        adminReview: {
          reviewedBy: admin.adminId,
          reviewedAt: new Date(),
          comments,
          decision: "approved",
        },
      },
      { new: true },
    );

    if (!company) throw createHttpError(404, "Company not found");
    res.json(apiSuccess(company, "Company verified"));
  } catch (error) {
    next(error);
  }
};

export const rejectCompany = async (req, res, next) => {
  try {
    const admin = await ensureAdminContext(req);
    const { companyId } = req.params;
    const { reason } = req.body;
    if (!reason) throw createHttpError(400, "Rejection reason is required");

    const company = await Company.findOneAndUpdate(
      { companyId },
      {
        status: "rejected",
        adminReview: {
          reviewedBy: admin.adminId,
          reviewedAt: new Date(),
          comments: reason,
          decision: "rejected",
        },
      },
      { new: true },
    );
    if (!company) throw createHttpError(404, "Company not found");
    res.json(apiSuccess(company, "Company rejected"));
  } catch (error) {
    next(error);
  }
};

export const suspendCompany = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { companyId } = req.params;
    const { reason } = req.body;
    const company = await Company.findOneAndUpdate(
      { companyId },
      { status: "suspended", restrictions: [reason].filter(Boolean) },
      { new: true },
    );
    if (!company) throw createHttpError(404, "Company not found");
    res.json(apiSuccess(company, "Company suspended"));
  } catch (error) {
    next(error);
  }
};

export const bulkImportStudents = async (req, res, next) => {
  try {
    const admin = await ensureAdminContext(req);
    const { students = [] } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      throw createHttpError(400, "students array is required");
    }

    const jobId = `IMPORT-${Date.now()}`;
    importJobs.set(jobId, { status: "processing", total: students.length, processed: 0, errors: [] });

    // simulate async import
    (async () => {
      for (const record of students) {
        try {
          if (!record.email || !record.name) {
            throw new Error("Missing email or name");
          }
          await Student.updateOne(
            { email: record.email },
            {
              $setOnInsert: {
                studentId: `STD-${Date.now()}`,
                firebaseUid: `import-${Date.now()}`,
                email: record.email,
                profile: {
                  name: record.name,
                  department: record.department || "Unknown",
                  year: record.year || 1,
                  college: record.college || "Default",
                },
              },
            },
            { upsert: true },
          );
          const job = importJobs.get(jobId);
          if (job) {
            job.processed += 1;
            importJobs.set(jobId, job);
          }
        } catch (error) {
          const job = importJobs.get(jobId);
          if (job) {
            job.errors.push({ record, error: error.message });
            importJobs.set(jobId, job);
          }
        }
      }
      const job = importJobs.get(jobId);
      if (job) {
        job.status = "completed";
        job.completedAt = new Date();
        importJobs.set(jobId, job);
      }
      logger.info("Student import completed", { jobId, admin: admin.adminId });
    })();

    res.status(202).json(apiSuccess({ jobId }, "Import started"));
  } catch (error) {
    next(error);
  }
};

export const getImportJobStatus = (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!importJobs.has(jobId)) throw createHttpError(404, "Job not found");
    res.json(apiSuccess(importJobs.get(jobId), "Import job status"));
  } catch (error) {
    next(error);
  }
};

export const assignMentor = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { mentorId, studentIds = [] } = req.body;
    if (!mentorId || !studentIds.length) throw createHttpError(400, "mentorId and studentIds are required");

    const mentor = await Mentor.findOne({ mentorId });
    if (!mentor) throw createHttpError(404, "Mentor not found");

    const students = await Student.find({ studentId: { $in: studentIds } });
    mentor.assignedStudents = Array.from(new Set([...(mentor.assignedStudents || []), ...students.map((s) => s._id)]));
    mentor.workload.current = mentor.assignedStudents.length;
    await mentor.save();

    res.json(apiSuccess({ mentor }, "Mentor assigned"));
  } catch (error) {
    next(error);
  }
};

export const processCredits = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { studentId } = req.body;
    const query = studentId ? { studentId } : {};
    const logbooks = await Logbook.find({ ...query, status: "approved" }).lean();
    const totalCredits = logbooks.reduce((sum, lb) => sum + (lb.mentorReview?.creditsApproved || 0), 0);
    res.json(apiSuccess({ totalCredits, count: logbooks.length }, "Credits processed"));
  } catch (error) {
    next(error);
  }
};

export const generateSystemReport = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { reportType } = req.body;
    const report = await Report.create({
      reportId: `SYS-${Date.now()}`,
      type: reportType || "admin",
      status: "processing",
      generatedAt: null,
    });
    logger.info("Admin report queued", { reportId: report.reportId });
    res.status(202).json(apiSuccess({ reportId: report.reportId }, "Report generation started"));
  } catch (error) {
    next(error);
  }
};

export const getAdminAnalytics = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const placements = await Application.aggregate([
      { $match: { status: "accepted" } },
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(apiSuccess({ placements }, "Admin analytics"));
  } catch (error) {
    next(error);
  }
};

export const getCollegeAnalytics = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const { college } = req.query;
    const query = college ? { "profile.college": college } : {};
    const students = await Student.find(query).select("profile readinessScore credits").lean();
    res.json(apiSuccess({ students }, "College analytics"));
  } catch (error) {
    next(error);
  }
};

export const getSystemHealth = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    const health = {
      mongo: mongoose.connection.readyState === 1 ? "up" : "down",
      redis: "up",
      uptime: process.uptime(),
      version: "v1",
    };
    res.json(apiSuccess(health, "System health"));
  } catch (error) {
    next(error);
  }
};

export const getAIUsageStats = async (req, res, next) => {
  try {
    await ensureAdminContext(req);
    // Placeholder analytics until aiUsageLogs collection is implemented
    res.json(
      apiSuccess(
        {
          usage: {
            interview: 0,
            summaries: 0,
            recommendations: 0,
          },
          costEstimateUSD: 0,
          modelDefaults: {
            flash: config.gemini.flashModel,
            pro: config.gemini.proModel,
          },
        },
        "AI usage stats",
      ),
    );
  } catch (error) {
    next(error);
  }
};

