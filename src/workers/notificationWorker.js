import { Worker, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import { notificationService } from "../services/notificationService.js";
import { smsService } from "../services/smsService.js";
import { logger } from "../utils/logger.js";

const NOTIFICATION_QUEUE = "notifications";

const notifyRole = (role) => async (data) =>
  notificationService.notifyUser({
    role,
    priority: data.priority || "medium",
    ...data,
  });

const jobHandlers = {
  "notify-student": notifyRole("student"),
  "notify-mentor": notifyRole("mentor"),
  "notify-admin": notifyRole("admin"),
  "notify-company": notifyRole("company"),
  "send-sms": async (data) => {
    if (!data.to || !data.body) throw new Error("SMS job missing to/body");
    return smsService.sendSMS({ to: data.to, body: data.body });
  },
  "send-whatsapp": async (data) => {
    if (!data.to || !data.body) throw new Error("WhatsApp job missing to/body");
    return smsService.sendWhatsApp({ to: data.to, body: data.body });
  },
  "send-push": async (data) => {
    logger.info("Push notification dispatched", {
      userId: data.userId,
      title: data.title,
      type: data.type,
    });
    return { mocked: true };
  },
};

const processor = async (job) => {
  const handler = jobHandlers[job.name];
  if (!handler) throw new Error(`Unsupported notification job: ${job.name}`);
  const result = await handler(job.data || {});
  logger.info("Notification job processed", { job: job.name, id: job.id });
  return result;
};

export const notificationWorker = new Worker(NOTIFICATION_QUEUE, processor, {
  connection: bullConnection,
  concurrency: 15,
  lockDuration: 60_000,
});

export const notificationQueueEvents = new QueueEvents(NOTIFICATION_QUEUE, { connection: bullConnection });

notificationQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error("Notification job failed", { jobId, reason: failedReason });
});

notificationQueueEvents.on("completed", ({ jobId }) => {
  logger.info("Notification job completed", { jobId });
});

notificationQueueEvents
  .waitUntilReady()
  .then(() => logger.info("Notification queue events ready"))
  .catch((error) => logger.error("Notification queue events error", { error: error.message }));

export default notificationWorker;
