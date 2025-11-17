import mongoose from "mongoose";
import Student from "../models/Student.js";
import Internship from "../models/Internship.js";
import Application from "../models/Application.js";
import Logbook from "../models/Logbook.js";
import InterviewSession from "../models/InterviewSession.js";
import Notification from "../models/Notification.js";
import { recommendationService } from "../services/recommendationService.js";
import { logbookSummaryService } from "../services/logbookSummaryService.js";
import { AIInterviewBot } from "../services/interviewBotService.js";
import { storageService } from "../services/storageService.js";
import { aiService } from "../services/aiService.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { createHttpError, resolveUserFromRequest, sanitizeDoc } from "./helpers/context.js";
import { get as redisGet, set as redisSet } from "../config/redis.js";
import { logger } from "../utils/logger.js";

const ensureStudentContext = async (req) => {
  const context = await resolveUserFromRequest(req);
  if (context.role !== "student") {
    throw createHttpError(403, "Only students can access this resource");
  }
  return context.doc;
};

const buildPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getStudentDashboard = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const cacheKey = `student:dashboard:${student._id}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.json(apiSuccess(JSON.parse(cached), "Student dashboard"));
    }

    const [applications, logbooks, notifications, recommended] = await Promise.all([
      Application.aggregate([
        { $match: { studentId: student._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Logbook.find({ studentId: student._id }).sort({ weekNumber: 1 }).lean(),
      Notification.find({ userId: student._id }).sort({ createdAt: -1 }).limit(10).lean(),
      recommendationService.getRecommendedInternships(student._id.toString(), []),
    ]);

    const stats = applications.reduce(
      (acc, entry) => {
        acc[entry._id] = entry.count;
        return acc;
      },
      { total: applications.reduce((sum, entry) => sum + entry.count, 0) },
    );

    const deadlines = logbooks
      .filter((lb) => lb.status === "draft" || lb.status === "submitted")
      .map((lb) => ({
        type: "logbook",
        weekNumber: lb.weekNumber,
        dueDate: lb.endDate,
        status: lb.status,
      }));

    const response = {
      student: sanitizeDoc(student, "student"),
      stats,
      credits: student.credits,
      logbooks: logbooks.slice(-3),
      notifications,
      recommendations: recommended.slice(0, 5),
      deadlines,
    };

    await redisSet(cacheKey, JSON.stringify(response), 300);
    return res.json(apiSuccess(response, "Student dashboard"));
  } catch (error) {
    next(error);
  }
};

export const browseInternships = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { page, limit, skip } = buildPagination(req);

    const filters = { status: "approved", applicationDeadline: { $gte: new Date() } };
    if (req.query.department) filters.department = req.query.department;
    if (req.query.location) filters.location = req.query.location;
    if (req.query.workMode) filters.workMode = req.query.workMode;
    if (req.query.skills) {
      const skills = Array.isArray(req.query.skills) ? req.query.skills : req.query.skills.split(",");
      filters.requiredSkills = { $in: skills.map((s) => s.trim()) };
    }
    if (req.query.minStipend) {
      filters.stipend = { $gte: Number(req.query.minStipend) };
    }

    const [items, total, appliedIds] = await Promise.all([
      Internship.find(filters).sort({ postedAt: -1 }).skip(skip).limit(limit).lean(),
      Internship.countDocuments(filters),
      Application.find({ studentId: student._id }).distinct("internshipId"),
    ]);

    const appliedSet = new Set(appliedIds.map((id) => id.toString()));
    const results = items.map((internship) => ({
      ...internship,
      alreadyApplied: appliedSet.has(internship._id.toString()),
      eligible:
        (!internship.eligibilityRequirements?.minReadinessScore ||
          student.readinessScore >= internship.eligibilityRequirements.minReadinessScore) &&
        (!internship.eligibilityRequirements?.requiredModules ||
          internship.eligibilityRequirements.requiredModules.every((module) =>
            student.completedModules.includes(module),
          )),
    }));

    res.json(
      apiSuccess(
        {
          items: results,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        "Internships",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getRecommendedInternships = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const cacheKey = `student:recommendations:${student._id}:${Math.floor(Date.now() / 600000)}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.json(apiSuccess(JSON.parse(cached), "Recommended internships"));
    }

    const internships = await Internship.find({ status: "approved" }).limit(20).lean();
    const recommendations = await recommendationService.getRecommendedInternships(student._id.toString(), internships);
    await redisSet(cacheKey, JSON.stringify(recommendations), 600);
    res.json(apiSuccess(recommendations, "Recommended internships"));
  } catch (error) {
    next(error);
  }
};

export const applyToInternship = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { internshipId, coverLetter, resumeUrl } = req.body;
    if (!internshipId || !coverLetter) {
      throw createHttpError(400, "internshipId and coverLetter are required");
    }
    if (!mongoose.Types.ObjectId.isValid(internshipId)) {
      throw createHttpError(400, "Invalid internshipId");
    }

    const internship = await Internship.findById(internshipId);
    if (!internship) throw createHttpError(404, "Internship not found");
    if (internship.status !== "approved" || internship.applicationDeadline < new Date()) {
      throw createHttpError(400, "Internship is not open for applications");
    }

    if (internship.eligibilityRequirements?.minReadinessScore && student.readinessScore < internship.eligibilityRequirements.minReadinessScore) {
      throw createHttpError(403, "Readiness score below required threshold");
    }

    if (
      internship.eligibilityRequirements?.requiredModules &&
      !internship.eligibilityRequirements.requiredModules.every((module) => student.completedModules.includes(module))
    ) {
      throw createHttpError(403, "Required modules not completed");
    }

    const exists = await Application.findOne({ studentId: student._id, internshipId });
    if (exists) throw createHttpError(409, "You have already applied to this internship");

    const application = await Application.create({
      applicationId: `APP-${Date.now()}`,
      studentId: student._id,
      internshipId,
      companyId: internship.companyId,
      department: internship.department,
      coverLetter,
      resumeUrl: resumeUrl || student.profile.resume,
      timeline: [
        {
          event: "application_submitted",
          performedBy: student.studentId,
          notes: "Application submitted by student",
        },
      ],
    });

    internship.appliedCount += 1;
    await internship.save();

    student.appliedInternships.push(application._id);
    await student.save();

    res.status(201).json(apiSuccess({ application }, "Application submitted"));
  } catch (error) {
    next(error);
  }
};

export const getMyApplications = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const statusFilter = req.query.status;

    const query = { studentId: student._id };
    if (statusFilter) query.status = statusFilter;

    const applications = await Application.find(query)
      .populate("internshipId")
      .populate("companyId")
      .sort({ appliedAt: -1 })
      .lean();

    res.json(apiSuccess({ applications }, "Student applications"));
  } catch (error) {
    next(error);
  }
};

export const withdrawApplication = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      throw createHttpError(400, "Invalid applicationId");
    }
    const application = await Application.findOne({ _id: applicationId, studentId: student._id });
    if (!application) throw createHttpError(404, "Application not found");
    if (["accepted", "shortlisted"].includes(application.status)) {
      throw createHttpError(400, "Cannot withdraw an application that is already accepted/shortlisted");
    }

    application.status = "withdrawn";
    application.timeline.push({
      event: "application_withdrawn",
      performedBy: student.studentId,
      notes: "Student withdrew the application",
    });
    await application.save();

    await Internship.findByIdAndUpdate(application.internshipId, { $inc: { appliedCount: -1 } });
    student.appliedInternships = student.appliedInternships.filter(
      (id) => id.toString() !== application._id.toString(),
    );
    await student.save();
    res.json(apiSuccess({ application }, "Application withdrawn"));
  } catch (error) {
    next(error);
  }
};

export const getRecommendedModules = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { targetInternshipId } = req.query;
    let internship = null;
    if (targetInternshipId && mongoose.Types.ObjectId.isValid(targetInternshipId)) {
      internship = await Internship.findById(targetInternshipId).lean();
    }
    const recommendations = await recommendationService.recommendModules(student._id.toString(), internship);
    res.json(apiSuccess(recommendations, "Recommended modules"));
  } catch (error) {
    next(error);
  }
};

export const startModule = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { moduleCode } = req.body;
    if (!moduleCode) throw createHttpError(400, "moduleCode is required");

    const alreadyStarted = student.moduleProgress?.find((m) => m.code === moduleCode);
    if (alreadyStarted) {
      return res.json(apiSuccess({ module: alreadyStarted }, "Module already in progress"));
    }

    student.moduleProgress.push({
      code: moduleCode,
      status: "in_progress",
      startedAt: new Date(),
    });
    await student.save();

    res.json(apiSuccess({ moduleCode }, "Module started"));
  } catch (error) {
    next(error);
  }
};

export const completeModule = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { moduleCode, score } = req.body;
    if (!moduleCode) throw createHttpError(400, "moduleCode is required");

    const moduleEntry = student.moduleProgress.find((m) => m.code === moduleCode);
    if (!moduleEntry) throw createHttpError(404, "Module not found in progress list");

    moduleEntry.status = "completed";
    moduleEntry.completedAt = new Date();
    if (score !== undefined) moduleEntry.score = score;

    if (!student.completedModules.includes(moduleCode)) {
      student.completedModules.push(moduleCode);
    }

    student.calculateReadinessScore();
    await student.save();

    res.json(apiSuccess({ moduleCode }, "Module completed"));
  } catch (error) {
    next(error);
  }
};

export const startInterviewPractice = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { domain, difficulty = "beginner" } = req.body;
    if (!domain) throw createHttpError(400, "domain is required");

    const session = await InterviewSession.create({
      sessionId: `INT-${Date.now()}`,
      studentId: student._id,
      domain,
      difficulty,
    });

    const bot = new AIInterviewBot(session.sessionId, domain, student.profile, difficulty);
    const firstQuestion = await bot.startInterview();

    session.conversationHistory = [
      {
        role: "model",
        parts: [{ text: firstQuestion.question }],
      },
    ];
    session.questionCount = 1;
    await session.save();

    res.status(201).json(
      apiSuccess(
        {
          sessionId: session.sessionId,
          question: firstQuestion.question,
          questionNumber: firstQuestion.questionNumber,
        },
        "Interview session started",
      ),
    );
  } catch (error) {
    next(error);
  }
};

const getInterviewBot = async (session) => {
  const bot = new AIInterviewBot(session.sessionId, session.domain, {}, session.difficulty);
  bot.history = session.conversationHistory || [];
  bot.questionCount = session.questionCount;
  return bot;
};

export const submitInterviewAnswer = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { sessionId, answer } = req.body;
    if (!sessionId || !answer) throw createHttpError(400, "sessionId and answer are required");

    const session = await InterviewSession.findOne({ sessionId, studentId: student._id });
    if (!session) throw createHttpError(404, "Interview session not found");
    if (session.status !== "active") throw createHttpError(400, "Interview session is no longer active");

    const bot = await getInterviewBot(session);
    const response = await bot.processAnswer(answer);

    session.conversationHistory.push({
      role: "user",
      parts: [{ text: answer }],
      timestamp: new Date(),
    });

    if (response.finished) {
      session.status = "completed";
      session.feedback = response.feedback;
      session.completedAt = new Date();
      await session.save();
      student.interviewAttempts += 1;
      student.calculateReadinessScore();
      await student.save();
      return res.json(apiSuccess({ feedback: response.feedback }, "Interview completed"));
    }

    session.conversationHistory.push({
      role: "model",
      parts: [{ text: response.nextQuestion }],
      timestamp: new Date(),
    });
    session.questionCount = response.questionNumber;
    await session.save();

    res.json(apiSuccess(response, "Next interview question"));
  } catch (error) {
    next(error);
  }
};

export const endInterview = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { sessionId } = req.body;
    if (!sessionId) throw createHttpError(400, "sessionId is required");

    const session = await InterviewSession.findOne({ sessionId, studentId: student._id });
    if (!session) throw createHttpError(404, "Interview session not found");

    const bot = await getInterviewBot(session);
    const feedback = await bot.endInterview();

    session.status = "completed";
    session.feedback = feedback;
    session.completedAt = new Date();
    await session.save();

    student.interviewAttempts += 1;
    student.calculateReadinessScore();
    await student.save();

    res.json(apiSuccess({ feedback }, "Interview completed"));
  } catch (error) {
    next(error);
  }
};

export const getInterviewHistory = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const sessions = await InterviewSession.find({ studentId: student._id, status: "completed" })
      .sort({ completedAt: -1 })
      .lean();
    res.json(apiSuccess(sessions, "Interview history"));
  } catch (error) {
    next(error);
  }
};

export const submitLogbook = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const payload = req.body;
    if (!payload.internshipId || !payload.weekNumber || !payload.activities) {
      throw createHttpError(400, "internshipId, weekNumber and activities are required");
    }

    const internship = await Internship.findById(payload.internshipId);
    if (!internship) throw createHttpError(404, "Internship not found");

    const existing = await Logbook.findOne({
      studentId: student._id,
      internshipId: payload.internshipId,
      weekNumber: payload.weekNumber,
    });
    if (existing) throw createHttpError(409, "Logbook already exists for this week");

    const logbook = await Logbook.create({
      ...payload,
      logbookId: `LOG-${Date.now()}`,
      studentId: student._id,
      companyId: internship.companyId,
      status: "submitted",
      submittedAt: new Date(),
    });

    // async summary generation (fire and forget)
    logbookSummaryService.generateLogbookSummary(logbook._id).catch((err) => logger.error("Logbook summary failed", err));

    res.status(201).json(apiSuccess({ logbook }, "Logbook submitted"));
  } catch (error) {
    next(error);
  }
};

export const getMyLogbooks = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const query = { studentId: student._id };
    if (req.query.status) query.status = req.query.status;
    const logbooks = await Logbook.find(query).populate("internshipId").sort({ weekNumber: 1 }).lean();
    res.json(apiSuccess(logbooks, "Student logbooks"));
  } catch (error) {
    next(error);
  }
};

export const getCreditsSummary = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const logbooks = await Logbook.find({ studentId: student._id, status: "approved" }).lean();
    const totalHours = logbooks.reduce((sum, lb) => sum + lb.hoursWorked, 0);
    const creditsEarned = Math.floor(totalHours / 30);

    res.json(
      apiSuccess(
        {
          credits: student.credits,
          logbooks,
          totalHours,
          creditsEarned,
          compliance: creditsEarned >= student.credits.approved,
        },
        "Credits summary",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const generateNEPReport = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    // In a full implementation, enqueue reportWorker job. For now respond with placeholder job id.
    const jobId = `NEP-${Date.now()}`;
    logger.info("NEP report requested", { studentId: student._id, jobId });
    res.status(202).json(apiSuccess({ jobId }, "NEP report generation started"));
  } catch (error) {
    next(error);
  }
};

export const chatbotQuery = async (req, res, next) => {
  try {
    const student = await ensureStudentContext(req);
    const { prompt } = req.body;
    if (!prompt) throw createHttpError(400, "prompt is required");

    const response = await aiService.generateContent(
      `You are Prashiskshan assistant helping student ${student.profile.name}. Their department is ${student.profile.department}, readiness score ${student.readinessScore}. Question: ${prompt}`,
      { model: "flash" },
    );

    res.json(apiSuccess({ response }, "Chatbot response"));
  } catch (error) {
    next(error);
  }
};


