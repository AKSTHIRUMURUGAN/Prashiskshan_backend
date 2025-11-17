import { Worker, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import { emailService } from "../services/emailService.js";
import Notification from "../models/Notification.js";
import { logger } from "../utils/logger.js";

const EMAIL_QUEUE = "emails";
const CTA_STYLE =
  "display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;";

const buildButton = (url, text = "View details") => {
  if (!url) return "";
  return `<p style="margin:24px 0;"><a href="${url}" style="${CTA_STYLE}">${text}</a></p>`;
};

const wrapEmail = ({ greeting, body, cta }) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;color:#111827;line-height:1.6;">
    <p>${greeting}</p>
    ${body}
    ${cta || ""}
    <p style="margin-top:32px;">Regards,<br/>Team Prashiskshan</p>
    <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px;color:#6b7280;">This is an automated message. Please do not reply.</p>
  </div>
`;

const TEMPLATE_HANDLERS = {
  "welcome-student": (data) => ({
    to: data.email,
    subject: "Welcome to Prashiskshan 🎓",
    html: wrapEmail({
      greeting: `Hi ${data.name || "there"},`,
      body: "<p>Welcome aboard! Complete your profile to unlock tailored internship recommendations and AI mentorship.</p>",
      cta: buildButton(data.loginUrl, "Complete your profile"),
    }),
  }),
  "application-submitted": (data) => ({
    to: data.email,
    subject: "Application submitted successfully",
    html: wrapEmail({
      greeting: `Hi ${data.studentName || "there"},`,
      body: `<p>Your application for <strong>${data.internshipTitle}</strong> at ${data.companyName} has been received.</p>
             <p>You can track the status anytime from your dashboard.</p>`,
      cta: buildButton(data.trackingUrl, "Track application"),
    }),
  }),
  "application-approved": (data) => ({
    to: data.email,
    subject: "Your internship application was approved 🎉",
    html: wrapEmail({
      greeting: `Hi ${data.studentName || "there"},`,
      body: `<p>Great news! Your application for <strong>${data.internshipTitle}</strong> has been approved.</p>
             <p>${data.nextSteps || "Please log in to view the next steps."}</p>`,
      cta: buildButton(data.nextStepsUrl, "View next steps"),
    }),
  }),
  "application-rejected": (data) => ({
    to: data.email,
    subject: "Update on your internship application",
    html: wrapEmail({
      greeting: `Hi ${data.studentName || "there"},`,
      body: `<p>Thank you for applying for <strong>${data.internshipTitle}</strong>.</p>
             <p>We couldn't move forward this time. ${
               data.feedback || "Keep building your skills and explore other opportunities on the platform."
             }</p>`,
      cta: buildButton(data.recommendationsUrl, "Explore other internships"),
    }),
  }),
  "logbook-approved": (data) => ({
    to: data.email,
    subject: `Week ${data.weekNumber} logbook approved`,
    html: wrapEmail({
      greeting: `Hi ${data.studentName || "there"},`,
      body: `<p>Your week ${data.weekNumber} logbook has been approved.</p>
             <p>Credits awarded: <strong>${data.creditsApproved || 0}</strong></p>`,
      cta: buildButton(data.logbookUrl, "View logbook"),
    }),
  }),
  "internship-completion": (data) => ({
    to: data.email,
    subject: "Congratulations on completing your internship! 🏆",
    html: wrapEmail({
      greeting: `Hi ${data.name || "there"},`,
      body: `<p>You've successfully completed your internship with <strong>${data.companyName}</strong>.</p>
             <p>Total credits earned: ${data.creditsEarned || 0}</p>`,
      cta: buildButton(data.certificateUrl, "Download certificate"),
    }),
  }),
  "new-internship-notification": (data) => ({
    to: data.email,
    subject: `New internship: ${data.internshipTitle}`,
    html: wrapEmail({
      greeting: `Hi ${data.name || "there"},`,
      body: `<p>${data.companyName} just posted <strong>${data.internshipTitle}</strong>.</p>
             <p>It matches your skills—apply before slots fill up!</p>`,
      cta: buildButton(data.applyUrl, "Review internship"),
    }),
  }),
  "deadline-reminder": (data) => ({
    to: data.email,
    subject: `${data.deadlineType || "Important"} deadline on ${data.deadlineDate}`,
    html: wrapEmail({
      greeting: `Hi ${data.name || "there"},`,
      body: `<p>This is a reminder that your ${data.deadlineType?.toLowerCase() || "upcoming"} deadline is on <strong>${data.deadlineDate}</strong>.</p>
             <p>Please take the required action to stay on track.</p>`,
      cta: buildButton(data.actionUrl, "Take action"),
    }),
  }),
};

const buildPayload = (job) => {
  const handler = TEMPLATE_HANDLERS[job.name];
  if (handler) {
    const payload = handler(job.data || {});
    if (!payload.to) {
      throw new Error(`Email template ${job.name} missing recipient address`);
    }
    return payload;
  }

  const { to, email, subject, html, text } = job.data || {};
  if (!(to || email)) throw new Error("Email job missing recipient");
  if (!subject) throw new Error("Email job missing subject");
  return {
    to: to || email,
    subject,
    html: html || `<p>${text || "Notification from Prashiskshan"}</p>`,
    text: text || html?.replace(/<[^>]+>/g, ""),
  };
};

const appendDeliveryLog = async ({ notificationId, status, metadata }) => {
  if (!notificationId) return;
  try {
    await Notification.updateOne(
      { notificationId },
      {
        $push: {
          deliveries: {
            channel: "email",
            status,
            sentAt: status === "sent" ? new Date() : undefined,
            metadata,
          },
        },
      },
    );
  } catch (error) {
    logger.error("Failed to log notification delivery", { error: error.message, notificationId });
  }
};

const processEmailJob = async (job) => {
  try {
    const payload = buildPayload(job);
    await emailService.sendEmail(payload);
    await appendDeliveryLog({ notificationId: job.data?.notificationId, status: "sent" });
    logger.info("Email sent", { template: job.name, to: payload.to });
    return { delivered: true };
  } catch (error) {
    await appendDeliveryLog({
      notificationId: job.data?.notificationId,
      status: "failed",
      metadata: { reason: error.message },
    });
    throw error;
  }
};

export const emailWorker = new Worker(EMAIL_QUEUE, processEmailJob, {
  connection: bullConnection,
  concurrency: 10,
  lockDuration: 60_000,
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE, { connection: bullConnection });

emailQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error("Email job failed", { jobId, reason: failedReason });
});

emailQueueEvents.on("completed", ({ jobId }) => {
  logger.info("Email job completed", { jobId });
});

emailQueueEvents
  .waitUntilReady()
  .then(() => logger.info("Email queue events ready"))
  .catch((error) => logger.error("Email queue events error", { error: error.message }));

export default emailWorker;
