import mongoose from "mongoose";

export const blogSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: { type: String },
    slug: { type: String },
    excerpt: { type: String },
    content: { type: String },
    tags: [{ type: String }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory" },
    featuredImage: { type: String },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    isScheduled:{ type: Boolean, default:false },
    scheduledAt: { type: Date, default: null },
    isFeatured: { type: Boolean, default: false },
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        content: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
  }
);
