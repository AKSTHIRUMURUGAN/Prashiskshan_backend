import { randomUUID } from "node:crypto";
import { Worker, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import Student from "../models/Student.js";
import Internship from "../models/Internship.js";
import Company from "../models/Company.js";
import Logbook from "../models/Logbook.js";
import InternshipCompletion from "../models/InternshipCompletion.js";
import { pdfService } from "../services/pdfService.js";
import { storageService } from "../services/storageService.js";
import { addToQueue } from "../queues/index.js";
import { logger } from "../utils/logger.js";

const COMPLETION_QUEUE = "completion-processing";
const HOURS_PER_CREDIT = 30;

const ensureDoc = (doc, label) => {
  if (!doc) throw new Error(`${label} not found`);
  return doc;
};

const computeHoursAndCredits = (logbooks = []) => {
  const totalHours = logbooks.reduce((sum, log) => sum + (log.hoursWorked || 0), 0);
  const credits = Math.floor(totalHours / HOURS_PER_CREDIT);
  return { totalHours, credits };
};

const generateCertificate = async ({ student, internship, company, credits }) => {
  const pdfBuffer = await pdfService.generateCertificate({
    studentName: student.profile?.name || student.email,
    companyName: company?.companyName || "Partner Company",
    internshipTitle: internship.title,
    credits,
  });
  return storageService.uploadFile(pdfBuffer, {
    filename: `certificates/${student.studentId}-${internship.internshipId || internship._id}.pdf`,
    contentType: "application/pdf",
  });
};

const notifyCompletion = async ({ studentId, internshipTitle, certificateUrl, credits }) => {
  await addToQueue("notification", "notify-student", {
    mongoId: studentId,
    title: "Internship completion recorded",
    message: `Congratulations! Your internship "${internshipTitle}" has been marked complete. Credits earned: ${credits}`,
    actionUrl: certificateUrl,
    priority: "high",
  });
};

const handleProcessCompletion = async (job) => {
  const { studentId, internshipId } = job.data || {};
  if (!studentId || !internshipId) throw new Error("studentId and internshipId are required");

  const [student, internship, logbooks] = await Promise.all([
    Student.findById(studentId),
    Internship.findById(internshipId),
    Logbook.find({ studentId, internshipId, status: "approved" }),
  ]);
  ensureDoc(student, "Student");
  ensureDoc(internship, "Internship");

  const company = internship.companyId ? await Company.findById(internship.companyId) : null;
  const { totalHours, credits } = computeHoursAndCredits(logbooks);

  const completionId = `CMP-${randomUUID().split("-")[0].toUpperCase()}`;

  const certificateUpload = await generateCertificate({
    student,
    internship,
    company,
    credits,
  });

  await InternshipCompletion.findOneAndUpdate(
    { studentId, internshipId },
    {
      completionId,
      companyId: company?._id || internship.companyId,
      totalHours,
      creditsEarned: credits,
      completionDate: new Date(),
      certificates: {
        certificateUrl: certificateUpload.url,
      },
      status: "issued",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Student.findByIdAndUpdate(studentId, {
    $inc: {
      "credits.earned": credits,
      "credits.approved": credits,
      completedInternships: 1,
    },
    $set: {
      "credits.pending": Math.max((student.credits?.pending || 0) - credits, 0),
    },
  });

  await notifyCompletion({
    studentId,
    internshipTitle: internship.title,
    certificateUrl: certificateUpload.url,
    credits,
  });

  return { completionId, credits, certificateUrl: certificateUpload.url };
};

const handleRecalculateCredits = async (job) => {
  const { studentId } = job.data || {};
  if (!studentId) throw new Error("studentId is required");

  const [student, completions] = await Promise.all([
    Student.findById(studentId),
    InternshipCompletion.find({ studentId }),
  ]);
  ensureDoc(student, "Student");

  const totalCredits = completions.reduce((sum, completion) => sum + (completion.creditsEarned || 0), 0);
  await Student.findByIdAndUpdate(studentId, {
    $set: {
      "credits.earned": totalCredits,
      "credits.approved": totalCredits,
      "credits.pending": 0,
    },
  });

  logger.info("Recalculated credits", { studentId, totalCredits });
  return { totalCredits };
};

const processor = async (job) => {
  switch (job.name) {
    case "process-completion":
      return handleProcessCompletion(job);
    case "recalculate-credits":
      return handleRecalculateCredits(job);
    default:
      throw new Error(`Unsupported completion job: ${job.name}`);
  }
};

export const completionWorker = new Worker(COMPLETION_QUEUE, processor, {
  connection: bullConnection,
  concurrency: 4,
  lockDuration: 120_000,
});

export const completionQueueEvents = new QueueEvents(COMPLETION_QUEUE, { connection: bullConnection });

completionQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error("Completion job failed", { jobId, reason: failedReason });
});

completionQueueEvents.on("completed", ({ jobId }) => {
  logger.info("Completion job completed", { jobId });
});

completionQueueEvents
  .waitUntilReady()
  .then(() => logger.info("Completion queue events ready"))
  .catch((error) => logger.error("Completion queue events error", { error: error.message }));

export default completionWorker;
