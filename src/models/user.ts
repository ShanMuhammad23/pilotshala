import mongoose from "mongoose";

export const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    authType: {
      type: String,
      required: true,
      enum: ["email", "google"],
    },
    verified: { type: Boolean, default: false },
    confirmationCode: String,
    passwordResetOtp: String,
    passwordResetOtpExpiry: Date,
    profilePicture: String,
    socketId: String,
    isAdmin: { type: Boolean, default: false },
    isManager:{ type:Boolean, default: false } ,
    isTeam:{ type: Boolean , default:false},
    showWalkthrough: { type: Boolean, default: true },
    lastActive: { type: Date, default: null },
    stripe: {
      customerId: String,
      subscriptionId: String,
    },
    razorpay: {
      customerId: String,
      subscriptionId: String,
      orderId: String,
    },
    subscription: {
      plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
      },
      gateway: {
        type: String,
        enum: ["stripe", "razorpay", "admin"],
      },
      paymentType:String,
      status: {
        type: String,
        enum: ["active", "inactive", "expired"],
      },
      purchaseDate: {
        type: Date,
        default: null,
      },
      startDate: {
        type: Date,
        default: null,
      },
      expire: {
        type: Date,
        default: null,
      },
      auto_pay: {
        type: Boolean,
        default: false,
      },
      free: {
        type: Boolean,
        default: false,
      },
      autoRenewalCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);
