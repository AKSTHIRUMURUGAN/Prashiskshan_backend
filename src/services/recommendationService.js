import { get as redisGet, set as redisSet } from "../config/redis.js";
import Student from "../models/Student.js";
import Internship from "../models/Internship.js";
import { aiService } from "./aiService.js";

const scoreInternship = (student, internship) => {
  const skills = student.profile.skills || [];
  const required = internship.requiredSkills || [];
  const matches = required.filter((skill) => skills.includes(skill));
  const matchScore = Math.round((matches.length / Math.max(required.length, 1)) * 100);
  const reasoning = matches.length
    ? `Matches ${matches.join(", ")}`
    : `Great to build ${required.slice(0, 2).join(", ")}`;
  return {
    internshipId: internship._id,
    matchScore,
    reasoning,
    skillMatches: matches,
    skillGaps: required.filter((skill) => !skills.includes(skill)),
    suggestedModules: required.filter((skill) => !skills.includes(skill)).map((skill) => `MOD-${skill.toUpperCase()}`),
  };
};

export const recommendationService = {
  async getRecommendedInternships(studentId, availableInternships = null) {
    const cacheKey = `reco:internships:${studentId}:${Math.floor(Date.now() / 600000)}`;
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const student = await Student.findById(studentId).lean();
    if (!student) return [];
    const internships =
      availableInternships && availableInternships.length
        ? availableInternships
        : await Internship.find({ status: "approved" }).limit(20).lean();
    const recommendations = internships.map((internship) => scoreInternship(student, internship)).sort((a, b) => b.matchScore - a.matchScore);
    await redisSet(cacheKey, JSON.stringify(recommendations), 600);
    return recommendations;
  },

  async getSmartFilters(studentId) {
    const student = await Student.findById(studentId).lean();
    if (!student) return {};
    return {
      departments: [student.profile.department],
      workMode: student.profile.year > 3 ? "onsite" : "remote",
      minStipend: student.profile.year >= 3 ? 5000 : 0,
      difficulty: student.readinessScore > 70 ? "advanced" : "beginner",
    };
  },

  async recommendModules(studentId, targetInternship = null) {
    const student = await Student.findById(studentId).lean();
    if (!student) return [];
    const requiredSkills = targetInternship?.requiredSkills || [];
    const missingSkills = requiredSkills.filter((skill) => !(student.profile.skills || []).includes(skill));
    if (!missingSkills.length) return [];
    const prompt = `Student skills: ${JSON.stringify(student.profile.skills)}
Missing skills: ${JSON.stringify(missingSkills)}
Suggest learning modules with priority and estimated completion weeks.
Return JSON array [{moduleCode,title,priority,estimatedWeeks}].`;
    try {
      return await aiService.generateStructuredJSON(prompt, { feature: "module_recommendation" });
    } catch (error) {
      return missingSkills.map((skill, index) => ({
        moduleCode: `SKILL-${skill.toUpperCase()}`,
        title: `${skill} fundamentals`,
        priority: index + 1,
        estimatedWeeks: 2,
      }));
    }
  },

  async getMentorRecommendations(mentorId, applications) {
    const prompt = `Rank these applications for mentor ${mentorId} based on readiness score, skill match, profile completeness:
${JSON.stringify(applications)}
Return JSON array [{applicationId,priority,notes}]`;
    try {
      return await aiService.generateStructuredJSON(prompt, { feature: "mentor_prioritization" });
    } catch (error) {
      return applications;
    }
  },
};

