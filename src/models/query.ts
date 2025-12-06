import mongoose from "mongoose";

export const querySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    readed: { type: Boolean, default: false },
    reply: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
