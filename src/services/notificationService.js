import Notification from "../models/Notification.js";
import Student from "../models/Student.js";
import Mentor from "../models/Mentor.js";
import Company from "../models/Company.js";
import Admin from "../models/Admin.js";
import { emailService } from "./emailService.js";
import { smsService } from "./smsService.js";
import { logger } from "../utils/logger.js";

const modelMap = {
  student: Student,
  mentor: Mentor,
  company: Company,
  admin: Admin,
};

const loadUserContext = async (role, mongoId) => {
  const Model = modelMap[role];
  if (!Model || !mongoId) return {};
  const doc = await Model.findById(mongoId).lean();
  if (!doc) return {};
  const preferences =
    role === "student"
      ? doc.preferences?.notificationChannels || {}
      : role === "mentor"
        ? doc.preferences?.notifications || {}
        : { email: true, realtime: true };
  const email = doc.email || doc.profile?.email || doc.pointOfContact?.email;
  const phone = doc.profile?.phone || doc.pointOfContact?.phone || doc.phone;
  return { preferences, email, phone };
};

const sendEmailChannel = async ({ to, title, message, actionUrl }) => {
  if (!to) return { status: "failed", metadata: { reason: "missing-email" } };
  try {
    await emailService.sendEmail({
      to,
      subject: title,
      html: `<p>${message}</p>${actionUrl ? `<p><a href="${actionUrl}">View details</a></p>` : ""}`,
    });
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", metadata: { reason: error.message } };
  }
};

const sendSmsChannel = async ({ to, message }) => {
  if (!to) return { status: "failed", metadata: { reason: "missing-phone" } };
  try {
    await smsService.sendSMS({ to, body: message });
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", metadata: { reason: error.message } };
  }
};

export const notificationService = {
  async notifyUser({
    userId,
    mongoId,
    role,
    email,
    phone,
    title,
    message,
    priority = "medium",
    actionUrl,
    metadata,
    channelOverrides,
  }) {
    const context = await loadUserContext(role, mongoId);
    const preferences = context.preferences || {};
    const channels = {
      email: channelOverrides?.email ?? preferences.email ?? true,
      sms: channelOverrides?.sms ?? preferences.sms ?? false,
      realtime: channelOverrides?.realtime ?? preferences.realtime ?? true,
    };

    const deliveries = [];
    if (channels.email) {
      deliveries.push({
        channel: "email",
        ...(await sendEmailChannel({ to: email || context.email, title, message, actionUrl })),
      });
    }
    if (channels.sms) {
      deliveries.push({
        channel: "sms",
        ...(await sendSmsChannel({ to: phone || context.phone, message })),
      });
    }

    try {
      await Notification.create({
        notificationId: `NTF-${Date.now()}`,
        userId: mongoId || userId,
        role,
        type: "system",
        title,
        message,
        priority,
        actionUrl,
        deliveries,
        metadata,
      });
    } catch (error) {
      logger.error("Failed to persist notification", { error: error.message });
    }

    return { deliveries, channels };
  },
};


