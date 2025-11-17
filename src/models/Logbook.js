import mongoose from "mongoose";

const { Schema } = mongoose;

const aiSummarySchema = new Schema(
  {
    summary: String,
    keySkillsDemonstrated: { type: [String], default: [] },
    learningOutcomes: { type: [String], default: [] },
    hoursVerification: Boolean,
    suggestedImprovements: String,
    estimatedProductivity: { type: String, enum: ["high", "medium", "low"] },
  },
  { _id: false },
);

const mentorReviewSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "needs_revision", "rejected"],
      default: "pending",
    },
    reviewedBy: String,
    reviewedAt: Date,
    comments: String,
    suggestions: String,
    creditsApproved: Number,
  },
  { _id: false },
);

const companyFeedbackSchema = new Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    technicalPerformance: Number,
    communication: Number,
    initiative: Number,
    comments: String,
    appreciation: String,
    improvements: String,
    tasksForNextWeek: { type: [String], default: [] },
    providedAt: Date,
  },
  { _id: false },
);

const logbookSchema = new Schema(
  {
    logbookId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    internshipId: { type: Schema.Types.ObjectId, ref: "Internship", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    weekNumber: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    hoursWorked: { type: Number, required: true, min: 0, max: 60 },
    activities: { type: String, required: true },
    tasksCompleted: { type: [String], default: [] },
    skillsUsed: { type: [String], default: [] },
    challenges: String,
    learnings: String,
    attachments: { type: [String], default: [] },
    aiSummary: aiSummarySchema,
    aiProcessedAt: Date,
    mentorReview: { type: mentorReviewSchema, default: () => ({}) },
    companyFeedback: companyFeedbackSchema,
    status: {
      type: String,
      enum: ["draft", "submitted", "pending_mentor_review", "pending_company_review", "approved", "needs_revision", "completed"],
      default: "draft",
      index: true,
    },
    submittedAt: Date,
  },
  { timestamps: true },
);

logbookSchema.index({ studentId: 1, weekNumber: 1 }, { unique: false });
logbookSchema.index({ internshipId: 1, weekNumber: 1 });
logbookSchema.index({ "mentorReview.status": 1, submittedAt: 1 });
logbookSchema.index({ companyId: 1, status: 1 });
logbookSchema.index({ studentId: 1, internshipId: 1, weekNumber: 1 }, { unique: true });

const Logbook = mongoose.model("Logbook", logbookSchema);

export default Logbook;

