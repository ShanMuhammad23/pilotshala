import mongoose from "mongoose";

export const examSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: { type: String },
    subject: { type: String },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    answers: [Number],
    timers: [Number],
    score: { type: Number, default: 0 },
    isStarted: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    duration: { type: Number, default: 0 },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    finishTime: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);
