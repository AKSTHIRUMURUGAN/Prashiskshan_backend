import fetch from "node-fetch";
import config from "../config/index.js";
import imagekitClient from "../config/imagekit.js";
import s3Client from "../config/s3.js";
import r2Client from "../config/r2.js";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { storageService } from "../services/storageService.js";
import { emailService } from "../services/emailService.js";
import { queueRegistry, addToQueue, getQueueStatus } from "../queues/index.js";
import bullConnection from "../config/bullmq.js";
import { Worker } from "bullmq";

const tryFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (err) {
    clearTimeout(id);
    return { error: err.message };
  }
};

export const integrationStatus = async (req, res) => {
  const probe = req.query.probe === "true" || req.query.probe === "1";
  const results = {};

  // Brevo
  results.brevo = { configured: Boolean(config.email.brevo.apiKey && config.email.brevo.fromEmail) };
  if (probe && results.brevo.configured) {
    const payload = {
      sender: { email: config.email.brevo.fromEmail, name: config.email.brevo.fromName || "Prashiskshan" },
      to: [{ email: config.email.brevo.fromEmail }],
      subject: "Prashiskshan Brevo probe",
      textContent: "This is a probe from Prashiskshan backend.",
    };
    const resp = await tryFetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": config.email.brevo.apiKey },
      body: JSON.stringify(payload),
    });
    results.brevo.probe = resp;
  }

  // Mailgun
  results.mailgun = { configured: Boolean(config.email.mailgun.apiKey && config.email.mailgun.domain) };
  if (probe && results.mailgun.configured) {
    const url = `https://api.mailgun.net/v3/domains/${config.email.mailgun.domain}`;
    const auth = Buffer.from(`api:${config.email.mailgun.apiKey}`).toString("base64");
    const resp = await tryFetch(url, { headers: { Authorization: `Basic ${auth}` } });
    results.mailgun.probe = resp;
  }

  // ImageKit
  results.imagekit = { configured: Boolean(config.imagekit.publicKey && config.imagekit.privateKey && config.imagekit.urlEndpoint) };
  if (probe && results.imagekit.configured) {
    try {
      const list = await imagekitClient.listFiles({ limit: 1 });
      results.imagekit.probe = { ok: true, data: list };
    } catch (err) {
      results.imagekit.probe = { error: err.message };
    }
  }

  // AWS S3
  results.s3 = { configured: Boolean(config.aws.accessKeyId && config.aws.secretAccessKey && config.aws.bucket) };
  if (probe && results.s3.configured) {
    try {
      const cmd = new ListObjectsV2Command({ Bucket: config.aws.bucket, MaxKeys: 1 });
      const resp = await s3Client.send(cmd);
      results.s3.probe = { ok: true, data: resp };
    } catch (err) {
      results.s3.probe = { error: err.message };
    }
  }

  // R2
  results.r2 = { configured: Boolean(config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket) };
  if (probe && results.r2.configured) {
    try {
      const cmd = new ListObjectsV2Command({ Bucket: config.r2.bucket, MaxKeys: 1 });
      const resp = await r2Client.send(cmd);
      results.r2.probe = { ok: true, data: resp };
    } catch (err) {
      results.r2.probe = { error: err.message };
    }
  }

  // Gemini (Generative AI)
  results.gemini = { configured: Boolean(config.gemini.apiKey && config.gemini.flashModel && config.gemini.proModel) };
  if (probe && results.gemini.configured) {
    results.gemini.probe = { note: "Live probe disabled by default. Use a separate smoke test to call Gemini." };
  }

  // Firebase
  results.firebase = { configured: Boolean(config.firebase.projectId && config.firebase.clientEmail) };
  if (probe && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const url = `http://${host}/`;
    const resp = await tryFetch(url);
    results.firebase.probe = resp;
  }

  return res.json({ success: true, probe: Boolean(probe), results });
};

export default { integrationStatus };

// Upload a tiny sample PNG image to the configured storage provider and return the URL
export const uploadSampleImage = async (req, res) => {
  try {
    const provider = (req.query.provider || "s3").toLowerCase();
    let buffer;
    let filename = `sample-image.png`;

    if (req && req.file && req.file.buffer) {
      buffer = req.file.buffer;
      // preserve original filename when available
      if (req.file.originalname) filename = req.file.originalname;
    } else {
      // 1x1 transparent PNG fallback
      const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
      buffer = Buffer.from(base64Png, "base64");
    }

    const result = await storageService.uploadFile(buffer, { filename, contentType: req.file && req.file.mimetype ? req.file.mimetype : "image/png", provider });
    return res.json({ success: true, provider: result.provider, url: result.url, key: result.key });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Send a test email using selected provider (brevo or mailgun)
export const sendTestEmail = async (req, res) => {
  try {
    const { provider, to, subject, html, text } = req.body || {};
    if (!to || !subject) return res.status(400).json({ success: false, error: "`to` and `subject` are required" });

    if (provider) {
      // force a specific provider
      try {
        const result = await emailService.sendEmailVia(provider, { to, subject, html, text });
        return res.json({ success: true, provider: result.provider });
      } catch (err) {
        return res.status(502).json({ success: false, error: err.message });
      }
    }

    // no provider specified: use default sendEmail logic (first available provider)
    try {
      const result = await emailService.sendEmail({ to, subject, html, text });
      return res.json({ success: true, provider: result.provider });
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Return status for all registered queues (counts and simple metrics)
export const listQueuesStatus = async (req, res) => {
  try {
    const keys = Object.keys(queueRegistry.definitions || {});
    const results = {};
    await Promise.all(
      keys.map(async (key) => {
        try {
          const status = await getQueueStatus(key);
          results[key] = { ok: true, status };
        } catch (err) {
          results[key] = { ok: false, error: err.message };
        }
      }),
    );
    return res.json({ success: true, queues: results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Enqueue a job to a named queueKey
export const enqueueJob = async (req, res) => {
  try {
    const { queueKey } = req.params;
    const { jobName = "test-job", data = {}, options = {} } = req.body || {};
    // Validate
    if (!queueRegistry.definitions[queueKey]) return res.status(404).json({ success: false, error: `Unknown queue ${queueKey}` });
    const job = await addToQueue(queueKey, jobName, data, options);
    return res.json({ success: true, jobId: job.id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// List jobs in a queue. Query `types` comma-separated (waiting, active, delayed, completed, failed)
export const listJobs = async (req, res) => {
  try {
    const { queueKey } = req.params;
    const queue = queueRegistry.queues[queueKey];
    if (!queue) return res.status(404).json({ success: false, error: `Unknown queue ${queueKey}` });
    const types = (req.query.types || "waiting,active,delayed,completed,failed").split(",").map((s) => s.trim());
    const jobs = await queue.getJobs(types, 0, 100);
    const mapped = await Promise.all(jobs.map(async (j) => ({ id: j.id, name: j.name, data: j.data, attemptsMade: j.attemptsMade, timestamp: j.timestamp, processedOn: j.processedOn, finishedOn: j.finishedOn, state: await j.getState() })));
    return res.json({ success: true, jobs: mapped });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Promote a delayed job to the waiting queue
export const promoteJob = async (req, res) => {
  try {
    const { queueKey, jobId } = req.params;
    const queue = queueRegistry.queues[queueKey];
    if (!queue) return res.status(404).json({ success: false, error: `Unknown queue ${queueKey}` });
    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
    await job.promote();
    return res.json({ success: true, promoted: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Remove a job from the queue
export const removeJob = async (req, res) => {
  try {
    const { queueKey, jobId } = req.params;
    const queue = queueRegistry.queues[queueKey];
    if (!queue) return res.status(404).json({ success: false, error: `Unknown queue ${queueKey}` });
    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
    await job.remove();
    return res.json({ success: true, removed: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Process next waiting job using a temporary worker — DEV only unless ALLOW_MANUAL_QUEUE_PROCESSING=true
export const processNextWaitingJob = async (req, res) => {
  try {
    const allow = process.env.NODE_ENV !== "production" || process.env.ALLOW_MANUAL_QUEUE_PROCESSING === "true";
    if (!allow) return res.status(403).json({ success: false, error: "Manual queue processing is disabled in production" });
    const { queueKey } = req.params;
    const { jobName } = req.body || {};
    const def = queueRegistry.definitions[queueKey];
    if (!def) return res.status(404).json({ success: false, error: `Unknown queue ${queueKey}` });

    const worker = new Worker(def.name, async (job) => {
      // If jobName provided, only process matching job; otherwise process any job
      if (jobName && job.name !== jobName) {
        // Re-throw to let it fail (so other workers may pick up later) — but we keep this worker short-lived
        throw new Error(`Skipping job ${job.id} (name ${job.name}) — expected ${jobName}`);
      }
      // No-op processing: mark as processed
      return { processedBy: "temp-worker", processedAt: Date.now() };
    }, { connection: bullConnection, concurrency: 1 });

    // Wait for a single job to be completed or failed, with timeout
    const timeoutMs = parseInt(process.env.MANUAL_QUEUE_TIMEOUT_MS || "8000", 10);
    const result = await new Promise((resolve) => {
      const onCompleted = ({ jobId }) => {
        worker.removeListener("failed", onFailed);
        resolve({ ok: true, event: "completed", jobId });
      };
      const onFailed = ({ jobId, failedReason }) => {
        worker.removeListener("completed", onCompleted);
        resolve({ ok: false, event: "failed", jobId, reason: failedReason });
      };
      worker.on("completed", onCompleted);
      worker.on("failed", onFailed);
      setTimeout(() => resolve({ ok: false, event: "timeout" }), timeoutMs);
    });

    await worker.close();
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
