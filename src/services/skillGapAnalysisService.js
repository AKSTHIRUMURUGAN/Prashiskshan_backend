import { get as redisGet, set as redisSet } from "../config/redis.js";
import Application from "../models/Application.js";
import Student from "../models/Student.js";
import Internship from "../models/Internship.js";
import { aiService } from "./aiService.js";
import { logger } from "../utils/logger.js";

const dayInSeconds = 60 * 60 * 24;

const aggregateDepartmentData = async (department) => {
  const rejectionData = await Application.aggregate([
    { $match: { department, status: "rejected" } },
    {
      $group: {
        _id: "$companyFeedback.rejectionReason",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const skillDemand = await Internship.aggregate([
    { $match: { department, status: "approved" } },
    { $unwind: "$requiredSkills" },
    {
      $group: {
        _id: "$requiredSkills",
        demand: { $sum: 1 },
      },
    },
    { $sort: { demand: -1 } },
    { $limit: 10 },
  ]);

  return { rejectionData, skillDemand };
};

export const skillGapAnalysisService = {
  async analyzeDepartmentSkillGaps(department) {
    const cacheKey = `skillgap:dept:${department}`;
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await aggregateDepartmentData(department);
    const prompt = `Analyze the following department data and identify critical skill gaps.
Department: ${department}
Rejection reasons: ${JSON.stringify(data.rejectionData)}
Skill demand: ${JSON.stringify(data.skillDemand)}
Return JSON with criticalSkillGaps[{skill,count,severity}], trendAnalysis (string), recommendations (array), suggestedInterventions (array).`;

    try {
      const analysis = await aiService.generateStructuredJSON(prompt, {
        feature: "skill_gap_dept",
        cacheKey,
        ttl: dayInSeconds,
      });
      await redisSet(cacheKey, JSON.stringify(analysis), dayInSeconds);
      return analysis;
    } catch (error) {
      logger.error("Department skill gap AI failed", { error: error.message });
      return {
        criticalSkillGaps: data.skillDemand.map((item) => ({
          skill: item._id,
          count: item.demand,
          severity: item.demand > 5 ? "high" : "medium",
        })),
        trendAnalysis: "Insufficient data from AI; fallback to direct counts.",
        recommendations: [],
        suggestedInterventions: [],
      };
    }
  },

  async analyzeStudentSkillGaps(studentId) {
    const student = await Student.findById(studentId).lean();
    if (!student) throw new Error("Student not found");
    const applications = await Application.find({ studentId }).populate("internshipId").lean();
    const targetSkills = applications
      .flatMap((app) => app.internshipId?.requiredSkills || [])
      .filter((skill, index, arr) => arr.indexOf(skill) === index);
    const missingSkills = targetSkills.filter((skill) => !(student.profile.skills || []).includes(skill));
    const prompt = `Student profile: ${JSON.stringify(student.profile)}
Completed modules: ${JSON.stringify(student.completedModules)}
Missing skills vs target internships: ${JSON.stringify(missingSkills)}
Provide JSON { topGaps: array of {skill, reason}, careerPathRecommendations: array, suggestedModules: array with priority, estimatedTimeToReady (weeks) }.`;
    return aiService.generateStructuredJSON(prompt, { feature: "skill_gap_student" });
  },

  async predictPlacementSuccess(studentId) {
    const student = await Student.findById(studentId).lean();
    if (!student) throw new Error("Student not found");
    const applications = await Application.countDocuments({ studentId, status: "accepted" });
    const totalApps = await Application.countDocuments({ studentId });
    const interviewSessions = student.interviewAttempts || 0;
    const readiness = student.readinessScore || 0;
    const successRate = totalApps ? applications / totalApps : 0;
    const probability = Math.min(0.9, 0.3 + readiness / 150 + successRate / 2 + interviewSessions * 0.02);
    return {
      probability: Number((probability * 100).toFixed(1)),
      factors: {
        readiness,
        interviewSessions,
        applications: totalApps,
        acceptance: applications,
      },
    };
  },

  async generateInterventionPlan(department, skillGaps) {
    const prompt = `Create an intervention plan for department ${department} targeting these skill gaps: ${JSON.stringify(skillGaps)}.
Return JSON with workshops (array), modules (array), expertSessions (array), expectedImpact (string).`;
    return aiService.generateStructuredJSON(prompt, { feature: "skill_gap_intervention" });
  },

  async trackSkillGapTrends(department, months = 6) {
    const pipeline = [
      { $match: { department } },
      {
        $group: {
          _id: {
            month: { $month: "$appliedAt" },
            year: { $year: "$appliedAt" },
          },
          rejections: {
            $sum: {
              $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: months },
    ];
    const data = await Application.aggregate(pipeline);
    return data
      .map((entry) => ({
        label: `${entry._id.month}/${entry._id.year}`,
        rejectionRate: entry.total ? Number(((entry.rejections / entry.total) * 100).toFixed(1)) : 0,
      }))
      .reverse();
  },

  async benchmarkAgainstIndustry(department) {
    const internships = await Internship.find({ department, status: "approved" }).limit(20).lean();
    const prompt = `Compare department ${department} readiness against generic industry standards for NEP internships.
Active internships: ${JSON.stringify(internships.map((i) => ({ title: i.title, skills: i.requiredSkills })))}.
Return JSON { readinessScore (0-100), summary, recommendations }.`;
    try {
      return await aiService.generateStructuredJSON(prompt, { feature: "skill_gap_benchmark" });
    } catch (error) {
      logger.error("Industry benchmark AI failed", { error: error.message });
      return { readinessScore: 50, summary: "Insufficient AI data; default baseline applied.", recommendations: [] };
    }
  },
};


