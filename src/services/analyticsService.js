import fetch from "node-fetch";
import config from "../config/index.js";
import { logger } from "../utils/logger.js";

// Simple GA4 Measurement Protocol helper to log events server-side.
// See: https://developers.google.com/analytics/devguides/collection/protocol/ga4
const measurementId = config.analytics && config.analytics.measurementId;
const apiSecret = config.analytics && config.analytics.apiSecret;

const baseUrl = (id, secret) => `https://www.google-analytics.com/mp/collect?measurement_id=${id}&api_secret=${secret}`;

export const analyticsService = {
  async logEvent({ clientId = "server", name, params = {} } = {}) {
    if (!measurementId || !apiSecret) {
      logger.debug("Analytics not configured; skipping logEvent", { name, params });
      return { skipped: true };
    }

    try {
      const url = baseUrl(measurementId, apiSecret);
      const payload = {
        client_id: clientId,
        events: [
          {
            name,
            params,
          },
        ],
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.warn("Analytics logEvent returned non-OK", { status: res.status, body: text, name });
        return { success: false, status: res.status, body: text };
      }

      return { success: true };
    } catch (err) {
      logger.error("Analytics logEvent failed", { error: err && err.message, name, params });
      return { success: false, error: err && err.message };
    }
  },
};

export default analyticsService;
