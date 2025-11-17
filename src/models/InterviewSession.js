import mongoose from "mongoose";

const { Schema } = mongoose;

const conversationPartSchema = new Schema(
  {
    text: String,
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    parts: { type: [conversationPartSchema], default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const feedbackSchema = new Schema(
  {
    overallScore: { type: Number, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    skillGaps: { type: [String], default: [] },
    technicalScore: Number,
    communicationScore: Number,
    confidenceScore: Number,
    detailedAnalysis: String,
  },
  { _id: false },
);

const interviewSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    domain: { type: String, required: true },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], required: true },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active", index: true },
    conversationHistory: { type: [conversationSchema], default: [] },
    questionCount: { type: Number, default: 0 },
    maxQuestions: { type: Number, default: 5 },
    feedback: feedbackSchema,
    reportUrl: String,
    aiTokensUsed: Number,
    completedAt: Date,
  },
  { timestamps: true },
);

interviewSessionSchema.index({ studentId: 1, status: 1, createdAt: -1 });
interviewSessionSchema.index({ status: 1, createdAt: 1 });

const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);

export default InterviewSession;

