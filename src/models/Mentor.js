import mongoose from "mongoose";

const { Schema } = mongoose;

const mentorSchema = new Schema(
  {
    mentorId: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    profile: {
      name: { type: String, required: true },
      department: { type: String, required: true, index: true },
      designation: String,
      phone: String,
      bio: String,
      expertiseAreas: { type: [String], default: [] },
      avatar: String,
    },
    assignedStudents: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    workload: {
      maxStudents: { type: Number, default: 30 },
      current: { type: Number, default: 0 },
    },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        realtime: { type: Boolean, default: true },
      },
    },
    lastLoginAt: Date,
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
    interventions: {
      type: [
        new Schema(
          {
            interventionId: { type: String, required: true },
            title: { type: String, required: true },
            description: String,
            targetStudents: [{ type: Schema.Types.ObjectId, ref: "Student" }],
            modules: { type: [String], default: [] },
            status: { type: String, enum: ["planned", "active", "completed"], default: "planned" },
            metrics: {
              engagementRate: Number,
              completionRate: Number,
            },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

mentorSchema.virtual("availability").get(function availability() {
  const { maxStudents = 0, current = 0 } = this.workload || {};
  if (!maxStudents) return 0;
  return Math.max(0, maxStudents - current);
});

mentorSchema.index({ "profile.department": 1, status: 1 });

const Mentor = mongoose.model("Mentor", mentorSchema);

export default Mentor;

