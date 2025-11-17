import { flashModel, proModel } from "../config/gemini.js";
import { get as redisGet, set as redisSet } from "../config/redis.js";
import AiUsageLog from "../models/AiUsageLog.js";
import { logger } from "../utils/logger.js";

const MODEL_MAP = {
  flash: flashModel,
  pro: proModel,
};

const DEFAULT_OPTIONS = {
  model: "flash",
  temperature: 0.5,
  maxOutputTokens: 1024,
};

const COST_PER_MILLION = {
  flash: { input: 0.075, output: 0.3 },
  pro: { input: 1.25, output: 5 },
};

const DEFAULT_CACHE_TTL = 60 * 60; // 1 hour

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithRetry = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    const delay = 500 * Math.pow(2, 2 - retries);
    await sleep(delay);
    return runWithRetry(fn, retries - 1);
  }
};

const chooseModel = (modelName = "flash") => {
  const model = MODEL_MAP[modelName] || MODEL_MAP.flash;
  if (!model) {
    throw new Error(`Gemini model ${modelName} not initialized`);
  }
  return model;
};

const extractText = (result) => {
  const candidates = result?.response?.candidates || result?.candidates || [];
  const parts = candidates[0]?.content?.parts || candidates[0]?.output || [];
  if (typeof parts === "string") return parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("\n")
      .trim();
  }
  return "";
};

export const estimateTokens = (text) => {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.round(words * 1.3);
};

const calculateCost = (model, inputTokens, outputTokens) => {
  const pricing = COST_PER_MILLION[model] || COST_PER_MILLION.flash;
  const inputCost = (pricing.input / 1_000_000) * inputTokens;
  const outputCost = (pricing.output / 1_000_000) * outputTokens;
  return Number((inputCost + outputCost).toFixed(6));
};

export const trackUsage = async ({ userId, role = "system", feature, tokensUsed, model, metadata }) => {
  try {
    await AiUsageLog.create({
      userId,
      role,
      feature,
      tokensUsed,
      model,
      costUsd: calculateCost(model, tokensUsed.input || 0, tokensUsed.output || 0),
      metadata,
    });
  } catch (error) {
    logger.error("Failed to track AI usage", { error: error.message });
  }
};

export const getCachedResponse = async (key) => {
  if (!key) return null;
  const cached = await redisGet(key);
  return cached ? JSON.parse(cached) : null;
};

export const setCachedResponse = async (key, value, ttl = DEFAULT_CACHE_TTL) => {
  if (!key) return;
  await redisSet(key, JSON.stringify(value), ttl);
};

export const aiService = {
  async generateContent(prompt, options = {}) {
    const { model, temperature, maxOutputTokens, userId, role, feature, cacheKey, ttl } = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (cacheKey) {
      const cached = await getCachedResponse(cacheKey);
      if (cached) return cached;
    }

    const generativeModel = chooseModel(model);
    const result = await runWithRetry(() =>
      generativeModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    );

    const output = extractText(result);
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(output);
    const response = {
      output,
      tokens: { input: inputTokens, output: outputTokens },
      model,
    };

    if (cacheKey) {
      await setCachedResponse(cacheKey, response, ttl || DEFAULT_CACHE_TTL);
    }

    if (feature) {
      trackUsage({
        userId,
        role,
        feature,
        model,
        tokensUsed: response.tokens,
        metadata: { cacheHit: false },
      });
    }

    return response;
  },

  async generateStructuredJSON(prompt, options = {}) {
    const response = await this.generateContent(`${prompt}\nReturn valid JSON only.`, options);
    const raw = response.output || "";
    const jsonString = raw.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error("Failed to parse Gemini JSON", { raw });
      throw new Error("AI response was not valid JSON");
    }
  },

  async startChat(history = [], options = {}) {
    const generativeModel = chooseModel(options.model || "flash");
    return generativeModel.startChat({
      history,
      generationConfig: {
        temperature: options.temperature || 0.5,
        maxOutputTokens: options.maxOutputTokens || 1024,
      },
    });
  },
};


