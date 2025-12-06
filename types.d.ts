import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace `any` with the appropriate type for your `user` object
      fileUrls?: string[];
      originalUrl?: string;
      imageType?: "profile" | "item" | "custom";
    }
  }
}
