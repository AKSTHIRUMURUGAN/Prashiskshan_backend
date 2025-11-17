import mongoose from "mongoose";

const { Schema } = mongoose;

const mentorApprovalSchema = new Schema(
  {
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    mentorId: String,
    approvedAt: Date,
    comments: String,
    recommendedPreparation: { type: [String], default: [] },
  },
  { _id: false },
);

const companyFeedbackSchema = new Schema(
  {
    status: { type: String, enum: ["pending", "reviewing", "shortlisted", "rejected"], default: "pending" },
    reviewedAt: Date,
    feedback: String,
    rejectionReason: String,
    nextSteps: String,
    scheduledInterviewDate: Date,
  },
  { _id: false },
);

const aiRankingSchema = new Schema(
  {
    matchScore: Number,
    reasoning: String,
    strengths: { type: [String], default: [] },
    concerns: { type: [String], default: [] },
    recommendation: String,
  },
  { _id: false },
);

const timelineSchema = new Schema(
  {
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    notes: String,
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    applicationId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    internshipId: { type: Schema.Types.ObjectId, ref: "Internship", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    department: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "mentor_approved", "mentor_rejected", "shortlisted", "rejected", "accepted", "withdrawn"],
      default: "pending",
      index: true,
    },
    appliedAt: { type: Date, default: Date.now, index: true },
    coverLetter: { type: String, required: true },
    resumeUrl: String,
    mentorApproval: mentorApprovalSchema,
    companyFeedback: companyFeedbackSchema,
    aiRanking: aiRankingSchema,
    interviewScore: Number,
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true },
);

applicationSchema.index({ studentId: 1, status: 1 });
applicationSchema.index({ internshipId: 1, status: 1 });
applicationSchema.index({ companyId: 1, "companyFeedback.status": 1 });
applicationSchema.index({ department: 1, "mentorApproval.status": 1 });
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ studentId: 1, internshipId: 1 }, { unique: true });

applicationSchema.methods.addTimelineEvent = function addTimelineEvent(event, performedBy, notes) {
  this.timeline.push({
    event,
    performedBy,
    notes,
    timestamp: new Date(),
  });
  return this.save();
};

const Application = mongoose.model("Application", applicationSchema);

export default Application;

