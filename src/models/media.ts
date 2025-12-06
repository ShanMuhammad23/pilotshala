import mongoose from "mongoose";

export const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video"] },
    name: { type: String },
    url: { type: String },
    size: { type: Number },
    imageKitId: { type: String },
  },
  {
    timestamps: true,
  }
);
