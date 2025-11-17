import mongoose from "mongoose";

const { Schema } = mongoose;

const aiUsageLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: false },
    role: { type: String, enum: ["student", "mentor", "company", "admin", "system"] },
    feature: { type: String, required: true },
    model: { type: String, required: true },
    tokensUsed: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

aiUsageLogSchema.index({ feature: 1, createdAt: -1 });

const AiUsageLog = mongoose.model("AiUsageLog", aiUsageLogSchema);

export default AiUsageLog;


