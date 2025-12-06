import mongoose from "mongoose";

export const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    choices: {
      type: [
        {
          isCorrect: { type: Boolean, default: false },
          choice: { type: String, required: true },
        },
      ],
      validate: {
        validator: function(choices: any[]) {
          // Ensure at least one choice is marked as correct
          return choices && choices.length > 0 && choices.some(choice => choice.isCorrect);
        },
        message: 'At least one choice must be marked as correct'
      }
    },
    subject: { type: String, required: true },
    book: { type: String, default: "" },
    topic: { type: String, default: "" },
    image: { type: String, default: "" },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    explanation: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);
