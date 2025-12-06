import mongoose from "mongoose";

export const planSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    interval: { type: String, required: true },
    stripePriceId: { type: String, required: false },
    razorpayPlanId: { type: String, default: "" },
    isActive: { type: Boolean, default: false },
    
  },
  {
    timestamps: true,
  }
);
