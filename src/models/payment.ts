import mongoose from "mongoose";

export const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    currency: { type: String },
    paymentMethod: { 
      type: String,
      enum: ["card", "upi", "netbanking", "wallet", "manual"],
      default: "manual"
    },
    paymentStatus: { 
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "completed"
    },
    paymentGateway: {
      type: String,
      enum: ["stripe", "razorpay", "admin"],
    },
    paymentId: { type: String },
    invoice: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    purchaseDate: { type: Date, default: Date.now },
    expireAt: { type: Date },
    // CRITICAL: Add fields for tracking failed payments
    failureReason: { type: String }, // Error code from payment gateway
    failureDescription: { type: String }, // Human-readable error description
  },
  {
    timestamps: true,
  }
);
