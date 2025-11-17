import mongoose from "mongoose";

const { Schema } = mongoose;

const eligibilitySchema = new Schema(
  {
    minYear: Number,
    minReadinessScore: Number,
    requiredModules: { type: [String], default: [] },
  },
  { _id: false },
);

const mentorApprovalSchema = new Schema(
  {
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    mentorId: String,
    approvedAt: Date,
    comments: String,
  },
  { _id: false },
);

const aiTagsSchema = new Schema(
  {
    primarySkills: { type: [String], default: [] },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    careerPath: String,
    industryFit: { type: [String], default: [] },
    learningIntensity: String,
    technicalDepth: String,
  },
  { _id: false },
);

const internshipSchema = new Schema(
  {
    internshipId: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    department: { type: String, required: true, index: true },
    requiredSkills: { type: [String], required: true },
    optionalSkills: { type: [String], default: [] },
    duration: { type: String, required: true },
    stipend: Number,
    location: String,
    workMode: { type: String, enum: ["remote", "onsite", "hybrid"], required: true },
    startDate: { type: Date, required: true },
    applicationDeadline: { type: Date, required: true, index: true },
    slots: { type: Number, required: true, min: 1 },
    appliedCount: { type: Number, default: 0 },
    responsibilities: { type: [String], default: [] },
    learningOpportunities: { type: [String], default: [] },
    eligibilityRequirements: eligibilitySchema,
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "closed", "cancelled"],
      default: "pending_approval",
      index: true,
    },
    mentorApproval: mentorApprovalSchema,
    aiTags: aiTagsSchema,
    postedBy: { type: String, required: true },
    postedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

internshipSchema.virtual("isActive").get(function isActive() {
  const now = new Date();
  return this.status === "approved" && (!this.applicationDeadline || this.applicationDeadline >= now);
});

internshipSchema.index({ department: 1, status: 1, applicationDeadline: 1 });
internshipSchema.index({ status: 1, startDate: 1 });
internshipSchema.index({ companyId: 1, status: 1 });
internshipSchema.index({ requiredSkills: 1 });
internshipSchema.index({ title: "text", description: "text" });

const Internship = mongoose.model("Internship", internshipSchema);

export default Internship;

