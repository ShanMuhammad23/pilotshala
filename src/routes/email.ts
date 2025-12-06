import express from "express";
import { sendExpiryReminderEmail, sendBulkExpiryReminderEmails } from "../controllers/email.js";
import { auth, admin } from "../middleware/auth.js";

const router = express.Router();

console.log("Email routes file loaded successfully");

// Test route to verify email routes are working
router.get("/test", (req, res) => {
  res.json({ message: "Email routes are working" });
});

// Simple test POST route
router.post("/simple-test", (req, res) => {
  console.log("Simple test POST called with body:", req.body);
  res.json({ 
    success: true, 
    message: "Simple test POST working",
    receivedBody: req.body 
  });
});

// Test email sending (without auth for debugging)
router.post("/test-send-no-auth", async (req, res) => {
  try {
    console.log("Test email endpoint called");
    const { sendEmail } = await import("../utils/email.js");
    const result = await sendEmail("test@example.com", "<h1>Test Email</h1><p>This is a test email.</p>", "Test Subject");
    res.json({ 
      success: result, 
      message: result ? "Test email sent successfully" : "Test email failed" 
    });
  } catch (error: any) {
    console.error("Test email error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test email sending (with auth)
router.post("/test-send", auth, admin, async (req, res) => {
  try {
    console.log("Test email endpoint called with auth");
    const { sendEmail } = await import("../utils/email.js");
    const result = await sendEmail("test@example.com", "<h1>Test Email</h1><p>This is a test email.</p>", "Test Subject");
    res.json({ 
      success: result, 
      message: result ? "Test email sent successfully" : "Test email failed" 
    });
  } catch (error: any) {
    console.error("Test email error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send single expiry reminder email
router.post("/send-expiry-reminder", auth, admin, sendExpiryReminderEmail);

// Send bulk expiry reminder emails
router.post("/send-bulk-expiry-reminders", auth, admin, sendBulkExpiryReminderEmails);

export default router; 