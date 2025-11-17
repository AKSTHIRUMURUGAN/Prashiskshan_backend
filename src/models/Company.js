import mongoose from "mongoose";

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    gstCertificate: String,
    cinNumber: { type: String, required: true, unique: true },
    registrationCertificate: String,
    addressProof: String,
  },
  { _id: false },
);

const pointOfContactSchema = new Schema(
  {
    name: { type: String, required: true },
    designation: String,
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false },
);

const aiVerificationSchema = new Schema(
  {
    riskLevel: { type: String, enum: ["low", "medium", "high"] },
    confidence: Number,
    findings: { type: [String], default: [] },
    concerns: { type: [String], default: [] },
    recommendation: String,
    analyzedAt: Date,
  },
  { _id: false },
);

const adminReviewSchema = new Schema(
  {
    reviewedBy: String,
    reviewedAt: Date,
    comments: String,
    decision: String,
  },
  { _id: false },
);

const statsSchema = new Schema(
  {
    totalInternshipsPosted: { type: Number, default: 0 },
    activeInternships: { type: Number, default: 0 },
    studentsHired: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
  },
  { _id: false },
);

const companySchema = new Schema(
  {
    companyId: { type: String, required: true, unique: true, index: true },
    firebaseUid: { type: String, required: true, unique: true },
    companyName: { type: String, required: true, index: true },
    website: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/i, "Website must be a valid URL"],
    },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    documents: { type: documentSchema, required: true },
    pointOfContact: { type: pointOfContactSchema, required: true },
    status: {
      type: String,
      enum: ["pending_verification", "verified", "rejected", "suspended"],
      default: "pending_verification",
      index: true,
    },
    aiVerification: aiVerificationSchema,
    adminReview: adminReviewSchema,
    restrictions: { type: [String], default: [] },
    colleges: { type: [String], default: [] },
    stats: { type: statsSchema, default: () => ({}) },
    lastLoginAt: Date,
    logoUrl: String,
    events: {
      type: [
        new Schema(
          {
            eventId: { type: String, required: true },
            title: String,
            description: String,
            date: Date,
            targetDepartments: { type: [String], default: [] },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    challenges: {
      type: [
        new Schema(
          {
            challengeId: { type: String, required: true },
            title: String,
            description: String,
            rewards: String,
            deadline: Date,
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

companySchema.index({ status: 1, createdAt: -1 });
companySchema.index({ companyName: "text" });

const Company = mongoose.model("Company", companySchema);

export default Company;

