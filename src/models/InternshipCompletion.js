import mongoose from "mongoose";

const { Schema } = mongoose;

const evaluationSchema = new Schema(
  {
    mentorScore: Number,
    companyScore: Number,
    overallComments: String,
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
  },
  { _id: false },
);

const certificateSchema = new Schema(
  {
    certificateUrl: String,
    recommendationLetterUrl: String,
  },
  { _id: false },
);

const completionSchema = new Schema(
  {
    completionId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    internshipId: { type: Schema.Types.ObjectId, ref: "Internship", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    totalHours: { type: Number, required: true },
    creditsEarned: { type: Number, required: true },
    completionDate: { type: Date, required: true },
    evaluation: evaluationSchema,
    certificates: certificateSchema,
    aiSummary: String,
    status: { type: String, enum: ["pending", "issued"], default: "pending" },
  },
  { timestamps: true },
);

completionSchema.index({ studentId: 1, internshipId: 1 }, { unique: true });

const InternshipCompletion = mongoose.model("InternshipCompletion", completionSchema);

export default InternshipCompletion;

