import { Worker, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import Logbook from "../models/Logbook.js";
import { logbookSummaryService } from "../services/logbookSummaryService.js";
import { addToQueue } from "../queues/index.js";
import { logger } from "../utils/logger.js";

const LOGBOOK_QUEUE = "logbook-processing";

const queueNotification = async ({ mentorId, studentId, logbook, summary }) => {
  if (!mentorId && !studentId) return;
  const studentName = logbook?.studentId?.profile?.name || "Student";
  const week = logbook?.weekNumber || summary?.weekNumber;
  const message = `Logbook week ${week} for ${studentName} is ready for review.`;

  const jobs = [];
  if (mentorId) {
    jobs.push(
      addToQueue("notification", "notify-mentor", {
        mongoId: mentorId,
        title: "Logbook ready for review",
        message,
        priority: "high",
        metadata: { logbookId: logbook?._id?.toString() },
      }),
    );
  }
  if (studentId) {
    jobs.push(
      addToQueue("notification", "notify-student", {
        mongoId: studentId,
        title: "Logbook processed",
        message: `Your week ${week} logbook summary is ready.`,
        priority: "medium",
        metadata: { logbookId: logbook?._id?.toString() },
      }),
    );
  }
  await Promise.allSettled(jobs);
};

const handleGenerateSummary = async (job) => {
  const { logbookId, mentorId, studentId, notifyMentor = true, notifyStudent = true } = job.data || {};
  if (!logbookId) throw new Error("logbookId is required");

  await job.updateProgress(5);
  const summary = await logbookSummaryService.generateLogbookSummary(logbookId);
  await job.updateProgress(70);

  if (notifyMentor || notifyStudent) {
    const logbook = await Logbook.findById(logbookId).populate("studentId", "profile.name");
    await queueNotification({
      mentorId: notifyMentor ? mentorId : null,
      studentId: notifyStudent ? studentId || logbook?.studentId?._id?.toString() : null,
      logbook,
      summary,
    });
  }

  await job.updateProgress(100);
  logger.info("Generated logbook summary", { logbookId });
  return summary;
};

const handleBatchProcess = async (job) => {
  const { logbookIds = [] } = job.data || {};
  if (!logbookIds.length) {
    throw new Error("logbookIds array required for batch-process job");
  }

  const results = [];
  for (let index = 0; index < logbookIds.length; index += 1) {
    const logbookId = logbookIds[index];
    try {
      const summary = await logbookSummaryService.generateLogbookSummary(logbookId);
      results.push({ logbookId, success: true, summary });
    } catch (error) {
      logger.error("Batch logbook summary failed", { logbookId, error: error.message });
      results.push({ logbookId, success: false, error: error.message });
    }
    const progress = Math.round(((index + 1) / logbookIds.length) * 100);
    await job.updateProgress(progress);
  }

  return results;
};

const processor = async (job) => {
  switch (job.name) {
    case "generate-summary":
      return handleGenerateSummary(job);
    case "batch-process":
      return handleBatchProcess(job);
    default:
      throw new Error(`Unsupported logbook job: ${job.name}`);
  }
};

export const logbookWorker = new Worker(LOGBOOK_QUEUE, processor, {
  connection: bullConnection,
  concurrency: 5,
  lockDuration: 60_000,
});

export const logbookQueueEvents = new QueueEvents(LOGBOOK_QUEUE, { connection: bullConnection });

logbookQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error("Logbook job failed", { jobId, reason: failedReason });
});

logbookQueueEvents.on("completed", ({ jobId }) => {
  logger.info("Logbook job completed", { jobId });
});

logbookQueueEvents
  .waitUntilReady()
  .then(() => logger.info("Logbook queue events ready"))
  .catch((error) => logger.error("Logbook queue events error", { error: error.message }));

export default logbookWorker;
