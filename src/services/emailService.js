import Mailgun from "mailgun.js";
import formData from "form-data";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const mailgunClient = (() => {
  if (!config.email.mailgun.apiKey || !config.email.mailgun.domain) return null;
  const mg = new Mailgun(formData);
  return mg.client({
    username: "api",
    key: config.email.mailgun.apiKey,
  });
})();

const sendViaBrevo = async ({ to, subject, html, text }) => {
  if (!config.email.brevo.apiKey || !config.email.brevo.fromEmail) {
    throw new Error("Brevo not configured");
  }
  const payload = {
    sender: {
      email: config.email.brevo.fromEmail,
      name: config.email.brevo.fromName,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.email.brevo.apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo error ${res.status}: ${body}`);
  }
};

const providers = [
  {
    name: "brevo",
    enabled: Boolean(config.email.brevo.apiKey),
    send: sendViaBrevo,
  },
  {
    name: "mailgun",
    enabled: Boolean(mailgunClient),
    send: async ({ to, subject, html, text }) => {
      if (!mailgunClient) throw new Error("Mailgun not configured");
      await mailgunClient.messages.create(config.email.mailgun.domain, {
        from: config.email.mailgun.fromEmail,
        to,
        subject,
        html,
        text: text || html?.replace(/<[^>]+>/g, ""),
      });
    },
  },
];

const buildContent = ({ subject, html, text, to }) => ({
  to,
  subject,
  html: html || `<p>${text || "Notification from Prashiskshan"}</p>`,
  text: text || html?.replace(/<[^>]+>/g, "") || "",
});

export const emailService = {
  async sendEmail(options) {
    const payload = buildContent(options);
    const activeProviders = providers.filter((provider) => provider.enabled);

    if (!activeProviders.length) {
      logger.warn("No email provider configured; logging message only", payload);
      return { mocked: true };
    }

    for (const provider of activeProviders) {
      try {
        await provider.send(payload);
        logger.info("Email sent", { provider: provider.name, to: payload.to });
        return { provider: provider.name };
      } catch (error) {
        logger.error("Email provider failed", { provider: provider.name, error: error.message });
      }
    }

    throw new Error("All email providers failed");
  },

  async sendTemplate(template, data) {
    switch (template) {
      case "welcome-student":
        return this.sendEmail({
          to: data.email,
          subject: "Welcome to Prashiskshan 🎓",
          html: `<p>Hi ${data.name},</p><p>Welcome to Prashiskshan! Complete your profile and start applying for internships today.</p><p>Regards,<br/>Team Prashiskshan</p>`,
        });
      case "application-submitted":
        return this.sendEmail({
          to: data.email,
          subject: "Application submitted successfully",
          html: `<p>Hi ${data.studentName},</p><p>Your application for <strong>${data.internshipTitle}</strong> at ${data.companyName} has been received.</p>`,
        });
      default:
        return this.sendEmail(data);
    }
  },
};


