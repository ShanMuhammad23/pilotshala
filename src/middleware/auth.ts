import { Request, Response, NextFunction } from "express";
import { User } from "../models/index.js";
import { verifyToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME } from "../utils/constants.js";

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const token =
      req.cookies[AUTH_COOKIE_NAME] || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Please Sign First!" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      req.user = user;
      next();
    } catch (dbError: any) {
      console.error("Database error in auth middleware:", dbError.message);
      return res.status(500).json({ message: "Database connection error" });
    }
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const admin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  if (!req.user?.isAdmin)
    return res.status(401).json({ message: "Unauthorized" });
  next();
};

export const paid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  if (req.user.subscription?.status === "active" || req?.user?.isAdmin) next();
  else {
    return res.status(403).json({
      error:
        "You need to purchase to a plan to create an exam. Go to Subscription page.",
    });
  }
};
