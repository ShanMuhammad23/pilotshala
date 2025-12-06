import express from "express";
import {
  createWebhook,
  razorpayWebhook2,
} from "../controllers/webhook.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.route("/").post(createWebhook);

// Test endpoint to verify webhook route is accessible
router.route("/test").get((req, res) => {
  res.json({ 
    message: "Webhook route is accessible",
    timestamp: new Date().toISOString(),
    environment: {
      razorpay_key_configured: !!process.env.RAZORPAY_KEY_ID,
      razorpay_secret_configured: !!process.env.RAZORPAY_KEY_SECRET,
      webhook_secret_configured: !!process.env.RAZORPAY_WEBHOOK_SECRET
    }
  });
});

// Simple test endpoint to verify webhook processing
router.route("/test-payment").post(express.json({ type: "application/json" }), (req, res) => {
  console.log("Test payment webhook received:", req.body);
  res.json({ 
    message: "Test payment webhook received",
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Main webhook endpoint for Razorpay
router
  .route("/razorpay2")
  .post(express.json({ type: "application/json" }), razorpayWebhook2);

export default router;
