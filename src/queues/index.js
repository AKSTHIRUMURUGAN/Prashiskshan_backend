import { Queue, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import { logger } from "../utils/logger.js";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const QUEUE_DEFINITIONS = {
  email: { name: "emails" },
  sms: { name: "sms" },
  logbook: { name: "logbook-processing" },
  report: { name: "report-generation" },
  notification: { name: "notifications" },
  completion: { name: "completion-processing" },
  ai: { name: "ai-processing" },
};

const queues = {};
const queueEvents = {};
let bullBoardRegistered = false;
let shuttingDown = false;

const initQueue = (key, definition) => {
  const queue = new Queue(definition.name, {
    connection: bullConnection,
    defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...definition.defaultJobOptions },
  });
  queues[key] = queue;

  const events = new QueueEvents(definition.name, { connection: bullConnection });
  events.on("failed", ({ jobId, failedReason }) => {
    logger.error(`Queue ${definition.name} job failed`, { jobId, failedReason });
  });
  events.on("completed", ({ jobId }) => {
    logger.info(`Queue ${definition.name} job completed`, { jobId });
  });

  events
    .waitUntilReady()
    .then(() => logger.info(`Queue events ready for ${definition.name}`))
    .catch((error) => logger.error(`Queue events failed for ${definition.name}`, { error: error.message }));

  queueEvents[key] = events;
  return queue;
};

Object.entries(QUEUE_DEFINITIONS).forEach(([key, definition]) => initQueue(key, definition));

export const getQueue = (queueKey) => queues[queueKey] || null;

export const addToQueue = async (queueKey, jobName, data = {}, options = {}) => {
  const queue = getQueue(queueKey);
  if (!queue) {
    throw new Error(`Queue ${queueKey} is not registered`);
  }
  return queue.add(jobName, data, options);
};

export const getQueueStatus = async (queueKey) => {
  const queue = getQueue(queueKey);
  if (!queue) throw new Error(`Queue ${queueKey} is not registered`);
  const [counts, metrics] = await Promise.all([queue.getJobCounts(), queue.getMetrics("completed")]);
  return {
    counts,
    metrics,
  };
};

export const registerBullBoard = async (app, { basePath = "/admin/queues", middleware } = {}) => {
  if (bullBoardRegistered) return null;
  try {
    const [{ createBullBoard }, { BullMQAdapter }] = await Promise.all([
      import("@bull-board/api"),
      import("@bull-board/api/bullMQAdapter"),
    ]);
    const { ExpressAdapter } = await import("@bull-board/express");
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: Object.values(queues).map((queue) => new BullMQAdapter(queue, { readOnlyMode: false })),
      serverAdapter,
    });

    const router = middleware ? [middleware, serverAdapter.getRouter()] : [serverAdapter.getRouter()];
    app.use(basePath, ...router);
    bullBoardRegistered = true;
    logger.info(`Bull Board mounted at ${basePath}`);
    return serverAdapter;
  } catch (error) {
    logger.warn("Bull Board not initialized", { reason: error.message });
    return null;
  }
};

const closeQueue = async (queue) => {
  try {
    await queue.close();
  } catch (error) {
    logger.error("Failed to close queue", { error: error.message, queue: queue.name });
  }
};

const closeQueueEvents = async (events) => {
  try {
    await events.close();
  } catch (error) {
    logger.error("Failed to close queue events", { error: error.message });
  }
};

export const shutdownQueues = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutting down BullMQ queues");
  await Promise.all([
    ...Object.values(queues).map((queue) => closeQueue(queue)),
    ...Object.values(queueEvents).map((events) => closeQueueEvents(events)),
  ]);
  logger.info("BullMQ queues closed");
};

const gracefulShutdownHandler = (signal) => {
  logger.info(`Received ${signal}, closing queues...`);
  shutdownQueues()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, gracefulShutdownHandler);
});

export const queueRegistry = Object.freeze({
  definitions: QUEUE_DEFINITIONS,
  queues,
});

export default queues;
