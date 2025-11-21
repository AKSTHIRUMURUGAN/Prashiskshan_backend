import fetch from "node-fetch";
import config from "../config/index.js";
import imagekitClient from "../config/imagekit.js";
import s3Client from "../config/s3.js";
import r2Client from "../config/r2.js";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

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
