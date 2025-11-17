import mongoose from "mongoose";
import Mentor from "../models/Mentor.js";
import Student from "../models/Student.js";
import Application from "../models/Application.js";
import Logbook from "../models/Logbook.js";
import { skillGapAnalysisService } from "../services/skillGapAnalysisService.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { createHttpError, resolveUserFromRequest } from "./helpers/context.js";

const ensureMentorContext = async (req) => {
  const context = await resolveUserFromRequest(req);
  if (context.role !== "mentor") throw createHttpError(403, "Mentor access required");
  return context.doc;
};

export const getMentorDashboard = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const department = mentor.profile.department;

    const [pendingApplications, pendingLogbooks, students, skillGaps] = await Promise.all([
      Application.countDocuments({ department, status: "pending" }),
      Logbook.countDocuments({ "mentorReview.status": "pending", status: { $in: ["submitted", "pending_mentor_review"] } }),
      Student.find({ "profile.department": department }).select("studentId readinessScore credits").lean(),
      skillGapAnalysisService.analyzeDepartmentSkillGaps(department),
    ]);

    const readinessStats = {
      average: students.length ? Math.round(students.reduce((sum, s) => sum + (s.readinessScore || 0), 0) / students.length) : 0,
      topPerformers: students.filter((s) => (s.readinessScore || 0) >= 80).length,
      needsImprovement: students.filter((s) => (s.readinessScore || 0) < 50).length,
    };

    res.json(
      apiSuccess(
        {
          mentor,
          stats: {
            pendingApplications,
            pendingLogbooks,
            assignedStudents: students.length,
          },
          readinessStats,
          skillGaps,
        },
        "Mentor dashboard",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPendingApplications = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      department: mentor.profile.department,
      status: "pending",
    };

    const applications = await Application.find(query)
      .populate("studentId")
      .populate("internshipId")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json(apiSuccess({ applications }, "Pending applications"));
  } catch (error) {
    next(error);
  }
};

export const getApplicationDetails = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) throw createHttpError(400, "Invalid applicationId");

    const application = await Application.findOne({
      _id: applicationId,
      department: mentor.profile.department,
    })
      .populate("studentId")
      .populate("internshipId")
      .populate("companyId")
      .lean();

    if (!application) throw createHttpError(404, "Application not found");
    res.json(apiSuccess(application, "Application details"));
  } catch (error) {
    next(error);
  }
};

export const approveApplication = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { applicationId } = req.params;
    const { comments, recommendedPreparation = [] } = req.body;

    const application = await Application.findOne({
      _id: applicationId,
      department: mentor.profile.department,
    });
    if (!application) throw createHttpError(404, "Application not found");
    if (application.status !== "pending") throw createHttpError(400, "Application is not pending mentor review");

    application.status = "mentor_approved";
    application.mentorApproval = {
      status: "approved",
      mentorId: mentor.mentorId,
      approvedAt: new Date(),
      comments,
      recommendedPreparation,
    };
    application.timeline.push({
      event: "mentor_approved",
      performedBy: mentor.mentorId,
      notes: comments,
      timestamp: new Date(),
    });
    await application.save();

    res.json(apiSuccess({ application }, "Application approved"));
  } catch (error) {
    next(error);
  }
};

export const rejectApplication = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { applicationId } = req.params;
    const { comments } = req.body;

    const application = await Application.findOne({
      _id: applicationId,
      department: mentor.profile.department,
    });
    if (!application) throw createHttpError(404, "Application not found");
    if (application.status !== "pending") throw createHttpError(400, "Application is not pending mentor review");

    application.status = "mentor_rejected";
    application.mentorApproval = {
      status: "rejected",
      mentorId: mentor.mentorId,
      approvedAt: new Date(),
      comments,
    };
    application.timeline.push({
      event: "mentor_rejected",
      performedBy: mentor.mentorId,
      notes: comments,
      timestamp: new Date(),
    });
    await application.save();

    res.json(apiSuccess({ application }, "Application rejected"));
  } catch (error) {
    next(error);
  }
};

export const getPendingLogbooks = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const logbooks = await Logbook.find({
      status: { $in: ["submitted", "pending_mentor_review"] },
      "mentorReview.status": { $in: ["pending", "needs_revision"] },
    })
      .populate("studentId")
      .populate("internshipId")
      .sort({ weekNumber: 1 })
      .lean();

    res.json(apiSuccess(logbooks, "Pending logbooks"));
  } catch (error) {
    next(error);
  }
};

export const getLogbookDetails = async (req, res, next) => {
  try {
    await ensureMentorContext(req);
    const { logbookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(logbookId)) throw createHttpError(400, "Invalid logbookId");

    const logbook = await Logbook.findById(logbookId).populate("studentId").populate("internshipId").lean();
    if (!logbook) throw createHttpError(404, "Logbook not found");

    res.json(apiSuccess(logbook, "Logbook details"));
  } catch (error) {
    next(error);
  }
};

export const approveLogbook = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { logbookId } = req.params;
    const { comments, creditsApproved = 0 } = req.body;

    const logbook = await Logbook.findById(logbookId);
    if (!logbook) throw createHttpError(404, "Logbook not found");

    logbook.mentorReview = {
      status: "approved",
      reviewedBy: mentor.mentorId,
      reviewedAt: new Date(),
      comments,
      creditsApproved,
    };
    logbook.status = "pending_company_review";
    await logbook.save();

    await Student.findByIdAndUpdate(logbook.studentId, {
      $inc: {
        "credits.pending": creditsApproved,
      },
    });

    res.json(apiSuccess({ logbook }, "Logbook approved"));
  } catch (error) {
    next(error);
  }
};

export const requestLogbookRevision = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { logbookId } = req.params;
    const { comments, suggestions } = req.body;

    const logbook = await Logbook.findById(logbookId);
    if (!logbook) throw createHttpError(404, "Logbook not found");

    logbook.mentorReview = {
      status: "needs_revision",
      reviewedBy: mentor.mentorId,
      reviewedAt: new Date(),
      comments,
      suggestions,
    };
    logbook.status = "needs_revision";
    await logbook.save();

    res.json(apiSuccess({ logbook }, "Revision requested"));
  } catch (error) {
    next(error);
  }
};

export const getSkillGapAnalysis = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const analysis = await skillGapAnalysisService.analyzeDepartmentSkillGaps(mentor.profile.department);
    res.json(apiSuccess(analysis, "Skill gap analysis"));
  } catch (error) {
    next(error);
  }
};

export const getDepartmentPerformance = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const department = mentor.profile.department;

    const [students, applications] = await Promise.all([
      Student.find({ "profile.department": department }).select("readinessScore credits").lean(),
      Application.find({ department }).select("status").lean(),
    ]);

    const placementRate =
      applications.length === 0
        ? 0
        : Math.round((applications.filter((app) => app.status === "accepted").length / applications.length) * 100);

    res.json(
      apiSuccess(
        {
          department,
          students: students.length,
          averageReadiness:
            students.length === 0 ? 0 : Math.round(students.reduce((sum, s) => sum + (s.readinessScore || 0), 0) / students.length),
          placementRate,
        },
        "Department performance",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const createIntervention = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const { title, description, targetStudents = [], modules = [] } = req.body;
    if (!title) throw createHttpError(400, "title is required");

    const intervention = {
      interventionId: `INTV-${Date.now()}`,
      title,
      description,
      targetStudents,
      modules,
      status: "planned",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mentor.interventions.push(intervention);
    await mentor.save();

    res.status(201).json(apiSuccess(intervention, "Intervention created"));
  } catch (error) {
    next(error);
  }
};

export const getInterventions = async (req, res, next) => {
  try {
    const mentor = await ensureMentorContext(req);
    const status = req.query.status;
    let interventions = mentor.interventions || [];
    if (status) {
      interventions = interventions.filter((item) => item.status === status);
    }
    res.json(apiSuccess(interventions, "Mentor interventions"));
  } catch (error) {
    next(error);
  }
};

export const getStudentProgress = async (req, res, next) => {
  try {
    await ensureMentorContext(req);
    const { studentId } = req.params;
    const student = await Student.findOne({ studentId }).lean();
    if (!student) throw createHttpError(404, "Student not found");

    const [applications, logbooks] = await Promise.all([
      Application.find({ studentId: student._id }).lean(),
      Logbook.find({ studentId: student._id }).lean(),
    ]);

    res.json(
      apiSuccess(
        {
          student,
          applications,
          logbooks,
        },
        "Student progress",
      ),
    );
  } catch (error) {
    next(error);
  }
};

