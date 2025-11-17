import mongoose from "mongoose";

const { Schema } = mongoose;

const adminSchema = new Schema(
  {
    adminId: { type: String, required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin", "support"], default: "admin" },
    permissions: { type: [String], default: [] },
    lastLoginAt: Date,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

adminSchema.index({ role: 1, status: 1 });

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;

