import mongoose from "mongoose";

const { Schema } = mongoose;

const preferencesSchema = new Schema(
  {
    notificationChannels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      realtime: { type: Boolean, default: true },
    },
    preferredLanguage: { type: String, default: "en" },
  },
  { _id: false },
);

const badgeSchema = new Schema(
  {
    name: String,
    icon: String,
    description: String,
    earnedAt: Date,
  },
  { _id: false },
);

const certificationSchema = new Schema(
  {
    type: String,
    companyName: String,
    position: String,
    certificateUrl: String,
    recommendationLetterUrl: String,
    creditsEarned: Number,
    completedAt: Date,
  },
  { _id: false },
);

const creditSchema = new Schema(
  {
    earned: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
  },
  { _id: false },
);

const profileSchema = new Schema(
  {
    name: { type: String, required: true },
    department: { type: String, required: true, index: true },
    year: { type: Number, required: true },
    college: { type: String, required: true, index: true },
    rollNumber: String,
    phone: String,
    bio: String,
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    resume: String,
    profileImage: String,
  },
  { _id: false },
);

const studentSchema = new Schema(
  {
    studentId: { type: String, required: true, unique: true, index: true },
    firebaseUid: { type: String, required: true, unique: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    profile: { type: profileSchema, required: true },
    readinessScore: { type: Number, default: 0, min: 0, max: 100 },
    completedModules: { type: [String], default: [] },
    moduleProgress: {
      type: [
        new Schema(
          {
            code: { type: String, required: true },
            status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
            startedAt: { type: Date, default: Date.now },
            completedAt: Date,
            score: Number,
            metadata: Schema.Types.Mixed,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    credits: { type: creditSchema, default: () => ({}) },
    appliedInternships: [{ type: Schema.Types.ObjectId, ref: "Application" }],
    completedInternships: { type: Number, default: 0 },
    certifications: { type: [certificationSchema], default: [] },
    badges: { type: [badgeSchema], default: [] },
    interviewAttempts: { type: Number, default: 0 },
    previousInternships: { type: Number, default: 0 },
    preferences: { type: preferencesSchema, default: () => ({}) },
    lastLoginAt: Date,
    status: {
      type: String,
      enum: ["active", "inactive", "deleted"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

studentSchema.virtual("profileCompletion").get(function profileCompletion() {
  const requiredFields = ["name", "department", "year", "college"];
  const optionalFields = ["rollNumber", "phone", "bio", "skills", "interests", "resume", "profileImage"];
  const profile = this.profile || {};
  const requiredFilled = requiredFields.filter((field) => Boolean(profile[field]?.length || profile[field])).length;
  const optionalFilled = optionalFields.filter((field) => {
    const value = profile[field];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }).length;
  const requiredScore = (requiredFilled / requiredFields.length) * 70;
  const optionalScore = (optionalFilled / optionalFields.length) * 30;
  return Math.round(requiredScore + optionalScore);
});

studentSchema.methods.calculateReadinessScore = function calculateReadinessScore() {
  const profileWeight = 0.4;
  const moduleWeight = 0.25;
  const interviewWeight = 0.15;
  const internshipWeight = 0.2;

  const profileScore = this.profileCompletion / 100;
  const moduleScore = Math.min(this.completedModules.length / 10, 1); // assume 10 modules for full score
  const interviewScore = Math.min(this.interviewAttempts / 5, 1);
  const internshipScore = Math.min(this.previousInternships / 3, 1);

  const score =
    profileScore * profileWeight +
    moduleScore * moduleWeight +
    interviewScore * interviewWeight +
    internshipScore * internshipWeight;

  this.readinessScore = Math.min(100, Math.round(score * 100));
  return this.readinessScore;
};

studentSchema.index({ "profile.department": 1, readinessScore: -1 });
studentSchema.index({ "profile.college": 1, "profile.year": 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;

