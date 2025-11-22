import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redisClient from "../config/redis.js";
import config from "../config/index.js";

const createRedisStore = () =>
  new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  });

const generalRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: "Too many requests, please try again later." },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: "Too many login attempts, please try again later." },
});

// Allow disabling the auth rate limiter in development via environment variable
// Set `AUTH_RATE_LIMIT_DISABLED=true` to bypass the authRateLimiter (useful for testing).
export const authRateLimiterMiddleware = process.env.AUTH_RATE_LIMIT_DISABLED === "true" ? (req, res, next) => next() : authRateLimiter;

const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: "Too many uploads, please try again later." },
});

const featureLimitKey = (userId, feature) => `ai_limit:${feature}:${userId}:${new Date().toISOString().slice(0, 10)}`;

const secondsUntilMidnight = () => {
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(24, 0, 0, 0);
  return Math.max(1, Math.floor((reset.getTime() - now.getTime()) / 1000));
};

export const aiFeatureLimit = (feature) => async (req, res, next) => {
  const userId = req.user?.mongoId?.toString() || req.firebase?.uid;
  if (!userId) return next();

  const limits = {
    interview: config.aiLimits.interviewDaily,
    chatbot: config.aiLimits.chatbotDaily,
    summary: config.aiLimits.summaryDaily,
  };
  const limit = limits[feature];
  if (!limit) return next();

  try {
    const key = featureLimitKey(userId, feature);
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, secondsUntilMidnight());
    }
    if (current > limit) {
      const ttl = await redisClient.ttl(key);
      return res.status(429).json({
        success: false,
        error: "AI daily limit reached",
        details: {
          feature,
          limit,
          resetInSeconds: ttl > 0 ? ttl : secondsUntilMidnight(),
        },
      });
    }
    return next();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return next(error);
    }
    return next();
  }
};

export { generalRateLimiter, authRateLimiter, uploadRateLimiter };

