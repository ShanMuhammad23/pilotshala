import mongoose from "mongoose";

export const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    quote: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    avatar: { type: String, required: true },
    type: {
      type: String,
      enum: ["student", "pilot"],
      default: "student",
    },
  },
  {
    timestamps: true,
  }
);
