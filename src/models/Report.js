import mongoose from "mongoose";

const { Schema } = mongoose;

const sectionSchema = new Schema(
  {
    title: String,
    content: String,
  },
  { _id: false },
);

const reportSchema = new Schema(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    internshipId: { type: Schema.Types.ObjectId, ref: "Internship" },
    generatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    type: { type: String, enum: ["nep", "completion", "recommendation", "admin"], required: true },
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
    sections: { type: [sectionSchema], default: [] },
    fileUrl: String,
    metadata: Schema.Types.Mixed,
    generatedAt: Date,
    failedReason: String,
  },
  { timestamps: true },
);

reportSchema.index({ studentId: 1, type: 1 });
reportSchema.index({ type: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;

