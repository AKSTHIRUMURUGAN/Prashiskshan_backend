import { Router } from "express";
import multer from "multer";
import { integrationStatus, uploadSampleImage } from "../controllers/testController.js";
import { sendTestEmail } from "../controllers/testController.js";
import { listQueuesStatus, enqueueJob } from "../controllers/testController.js";
import { listJobs, promoteJob, removeJob, processNextWaitingJob } from "../controllers/testController.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/_tests?probe=true
router.get("/", integrationStatus);

// POST /api/_tests/s3-upload?provider=s3|r2
// Accepts a multipart/form-data file field named `file`. If no file provided, uploads a tiny sample PNG.
router.post("/s3-upload", upload.single("file"), uploadSampleImage);

// POST /api/_tests/send-email
// body: { provider?: 'brevo'|'mailgun', to: string, subject: string, html?: string, text?: string }
router.post("/send-email", async (req, res, next) => sendTestEmail(req, res, next));

// GET /api/_tests/queues
router.get("/queues", listQueuesStatus);

// POST /api/_tests/queues/:queueKey/enqueue
// body: { jobName?: string, data?: object, options?: object }
router.post("/queues/:queueKey/enqueue", async (req, res, next) => enqueueJob(req, res, next));

// GET jobs in a queue: /api/_tests/queues/:queueKey/jobs?types=waiting,active
router.get("/queues/:queueKey/jobs", listJobs);

// POST promote a delayed job to waiting
router.post("/queues/:queueKey/jobs/:jobId/promote", promoteJob);

// POST remove a job
router.post("/queues/:queueKey/jobs/:jobId/remove", removeJob);

// POST process next waiting job (dev-only unless enabled)
router.post("/queues/:queueKey/process-next", processNextWaitingJob);

export default router;
