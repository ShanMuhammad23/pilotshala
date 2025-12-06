import mongoose from "mongoose";

export const topicCompletionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    book: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 0,
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0,
    },
  incorrectAnswers: {
    type: Number,
    required: true,
    min: 0,
  },
  unattempted: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  attempts: {
    type: Number,
    default: 1,
    min: 0,
  },
  isManuallyMarked: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying and ensuring uniqueness
topicCompletionSchema.index(
  { userId: 1, subject: 1, book: 1, topic: 1 },
  { unique: true }
);

// Index for querying user's completions sorted by completion date
topicCompletionSchema.index({ userId: 1, completedAt: -1 });

