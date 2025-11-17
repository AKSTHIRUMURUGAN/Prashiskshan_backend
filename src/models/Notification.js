import mongoose from "mongoose";

const { Schema } = mongoose;

const deliverySchema = new Schema(
  {
    channel: { type: String, enum: ["email", "sms", "whatsapp", "push"], required: true },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    sentAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { _id: false },
);

const notificationSchema = new Schema(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["student", "mentor", "admin", "company"], required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    actionUrl: String,
    read: { type: Boolean, default: false },
    readAt: Date,
    deliveries: { type: [deliverySchema], default: [] },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ role: 1, priority: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

