import twilio from "twilio";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

const twilioClient =
  config.twilio.accountSid && config.twilio.authToken
    ? twilio(config.twilio.accountSid, config.twilio.authToken)
    : null;

export const smsService = {
  async sendSMS({ to, body }) {
    if (!twilioClient) {
      logger.warn("Twilio not configured; logging SMS", { to, body });
      return { mocked: true };
    }
    const message = await twilioClient.messages.create({
      to,
      from: config.twilio.phoneNumber,
      body,
    });
    return message;
  },

  async sendWhatsApp({ to, body }) {
    if (!twilioClient || !config.twilio.whatsappNumber) {
      logger.warn("Twilio WhatsApp not configured; logging", { to, body });
      return { mocked: true };
    }
    const message = await twilioClient.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${config.twilio.whatsappNumber}`,
      body,
    });
    return message;
  },
};


