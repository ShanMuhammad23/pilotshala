import express from "express";
import { Payment } from "../models/index.js";

export const getPayments = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    let payments = [];
    if (req.user?.isAdmin) payments = await Payment.find().populate("plan");
    else
      payments = await Payment.find({ user: req.user?._id }).populate("plan");
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments", error });
  }
};

export const getPaymentsByUserId = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const { id } = req.params;
    // Only allow if admin or requesting own payments
    if (!req.user?.isAdmin && req.user?._id.toString() !== id) {
      res.status(403).json({ message: "Forbidden: Not allowed to access other users' payments" });
      return;
    }
    const payments = await Payment.find({ user: id }).populate("plan");
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments by user", error });
  }
};
