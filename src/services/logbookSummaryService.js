import { get as redisGet, set as redisSet } from "../config/redis.js";
import Logbook from "../models/Logbook.js";
import { aiService } from "./aiService.js";
import { logger } from "../utils/logger.js";

const SUMMARY_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SUMMARY_CACHE_KEY = (logbookId) => `logbook:summary:${logbookId}`;
const QUALITY_CACHE_KEY = (logbookId) => `logbook:quality:${logbookId}`;

const buildSummaryPrompt = (logbook) => `You are an AI mentor summarizing a weekly internship logbook for NEP 2020 compliance.
Return JSON with keys: summary (2 sentences), keySkillsDemonstrated (array), learningOutcomes (array),
hoursVerification (boolean), suggestedImprovements (string), estimatedProductivity ('high'|'medium'|'low').

Student week ${logbook.weekNumber}
Hours worked: ${logbook.hoursWorked}
Activities: ${logbook.activities}
Tasks Completed: ${(logbook.tasksCompleted || []).join(", ")}
Skills Used: ${(logbook.skillsUsed || []).join(", ")}
Challenges: ${logbook.challenges || "None"}
Learnings: ${logbook.learnings || "Not provided"}
`;

export const logbookSummaryService = {
  async generateLogbookSummary(logbookId) {
    const cacheKey = SUMMARY_CACHE_KEY(logbookId);
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const logbook = await Logbook.findById(logbookId);
    if (!logbook) throw new Error("Logbook not found");

    const prompt = buildSummaryPrompt(logbook);
    const summary = await aiService.generateStructuredJSON(prompt, {
      cacheKey: `ai:logbook:${logbookId}`,
      ttl: SUMMARY_TTL_SECONDS,
      feature: "logbook_summary",
      userId: logbook.studentId,
      role: "student",
    });

    logbook.aiSummary = summary;
    logbook.aiProcessedAt = new Date();
    if (["submitted", "draft"].includes(logbook.status)) {
      logbook.status = "pending_mentor_review";
    }
    await logbook.save();
    await redisSet(cacheKey, JSON.stringify(summary), SUMMARY_TTL_SECONDS);
    return summary;
  },

  async batchGenerateSummaries(logbookIds) {
    const limit = 5;
    const results = [];
    for (let i = 0; i < logbookIds.length; i += limit) {
      const chunk = logbookIds.slice(i, i + limit);
      const chunkResults = await Promise.all(
        chunk.map(async (id) => {
          try {
            const summary = await this.generateLogbookSummary(id);
            return { logbookId: id, success: true, summary };
          } catch (error) {
            logger.error("Logbook summary failed", { logbookId: id, error: error.message });
            return { logbookId: id, success: false, error: error.message };
          }
        }),
      );
      results.push(...chunkResults);
    }
    return results;
  },

  async validateLogbookQuality(logbook) {
    const cacheKey = QUALITY_CACHE_KEY(logbook.logbookId || logbook._id);
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const prompt = `Assess the quality of this internship logbook entry. Evaluate detail, professionalism, technical depth, and learning reflection. Return JSON with fields: qualityScore (0-100), feedback (string), suggestions (array).
Entry: ${logbook.activities}
Learnings: ${logbook.learnings || "N/A"}
Challenges: ${logbook.challenges || "N/A"}`;

    const analysis = await aiService.generateStructuredJSON(prompt, {
      cacheKey,
      ttl: 3600,
      feature: "logbook_quality",
      userId: logbook.studentId,
      role: "student",
    });
    await redisSet(cacheKey, JSON.stringify(analysis), 3600);
    return analysis;
  },

  async extractSkills(text) {
    const prompt = `Extract technical skills mentioned in the following text. Return JSON array of standardized skill names.\n${text}`;
    const response = await aiService.generateStructuredJSON(prompt, { feature: "logbook_skill_extract" });
    return Array.isArray(response) ? response : [];
  },
};


