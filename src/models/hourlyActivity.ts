import mongoose from "mongoose";

export const hourlyActivitySchema = new mongoose.Schema(
  {
    date: { 
      type: String, 
      required: true,
      index: true 
    }, // YYYY-MM-DD format
    hour: { 
      type: Number, 
      required: true,
      min: 0,
      max: 23,
      index: true 
    },
    totalUsers: { 
      type: Number, 
      default: 0 
    },
    activeUsers: { 
      type: Number, 
      default: 0 
    },
    uniqueUsers: { 
      type: Number, 
      default: 0 
    },
    activeUserIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }], // Track unique user IDs for the hour
    lastUpdated: { 
      type: Date, 
      default: Date.now 
    }
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries by date and hour
hourlyActivitySchema.index({ date: 1, hour: 1 }, { unique: true });

export default hourlyActivitySchema; 