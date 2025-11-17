import InterviewSession from "../models/InterviewSession.js";
import { aiService } from "./aiService.js";
import { logger } from "../utils/logger.js";

const MAX_QUESTIONS_DEFAULT = 5;

export class AIInterviewBot {
  constructor(sessionId, domain, studentProfile, difficulty = "beginner") {
    this.sessionId = sessionId;
    this.domain = domain;
    this.studentProfile = studentProfile;
    this.difficulty = difficulty;
    this.history = [];
    this.maxQuestions = MAX_QUESTIONS_DEFAULT;
    this.questionCount = 0;
  }

  async startInterview() {
    const prompt = `You are conducting a mock interview for a ${this.domain} internship. Start with a professional greeting and ask the candidate to "Tell me about yourself" while referencing their department (${this.studentProfile?.department ||
      "N/A"}) and year (${this.studentProfile?.year || "N/A"}).`;
    const response = await aiService.generateContent(prompt, { model: "flash" });
    const text = response?.output || "Tell me about yourself.";
    this.history.push({ role: "model", parts: [{ text }] });
    this.questionCount = 1;
    return { question: text, questionNumber: 1 };
  }

  async processAnswer(answer) {
    this.history.push({ role: "user", parts: [{ text: answer }], timestamp: new Date() });
    this.questionCount += 1;

    if (this.questionCount > this.maxQuestions) {
      const feedback = await this.endInterview();
      return { finished: true, feedback };
    }

    const prompt = `You are continuing a mock ${this.domain} interview. The candidate just answered: "${answer}".
Provide a brief evaluation (one sentence) and ask the next question. Increase difficulty gradually for ${this.difficulty} level.`;

    const response = await aiService.generateContent(prompt, { model: "flash" });
    const nextQuestion = response?.output || "Let's discuss your technical experience.";
    this.history.push({ role: "model", parts: [{ text: nextQuestion }], timestamp: new Date() });

    return {
      evaluation: "Thanks for the answer. Here's the next question.",
      nextQuestion,
      questionNumber: this.questionCount,
      finished: false,
    };
  }

  async endInterview() {
    const prompt = `Summarize the mock interview for a ${this.domain} role. Provide JSON with fields:
overallScore (0-100), strengths (array), improvements (array), skillGaps (array), technicalScore, communicationScore, confidenceScore, detailedAnalysis (string).`;

    const result = await aiService.generateStructuredJSON(prompt, { model: "flash" });
    return result;
  }

  static async resumeSession(sessionId) {
    const session = await InterviewSession.findOne({ sessionId });
    if (!session) return null;
    const bot = new AIInterviewBot(session.sessionId, session.domain, {}, session.difficulty);
    bot.history = session.conversationHistory || [];
    bot.questionCount = session.questionCount || 0;
    return bot;
  }
}

