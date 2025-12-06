import {
  createUser,
  getUserDetails,
  loginWithEmail,
  loginWithGoogle,
  confirmEmail,
  updateUser,
  getAllUsers,
  logout,
  getCookie,
  hideWalkthrough,
  sendConfirmationCode,
  changeUserPlan,
  suspendUserPlan,
  addUser,
  deleteUser,
  editUser,
  addFreeAccess,
  extendUserPlan,
  getSubscriptionDetails,
  getUsersByExpiryDate,
  grantManagerAccess,
  grantTeamAccess,
  revokeManagerAccess,
  revokeTeamAccess,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from "../controllers/user.js";
import { sendExpiryReminderEmail, sendBulkExpiryReminderEmails, sendBulkCustomEmails } from "../controllers/email.js";
import express from "express";
import { admin, auth } from "../middleware/auth.js";
//   import handleMultipleImageUpload from "../middleware/s3.js";

const router = express.Router();

router.route("/").put(auth, updateUser).get(auth, getUserDetails);
router.route("/create").post(createUser);
router.route("/create-admin").post(auth, admin, addUser);
router.route("/login-email").post(loginWithEmail);
router.route("/login-google").post(loginWithGoogle);
router.route("/code").get(auth, sendConfirmationCode);
router.route("/confirm").post(auth, confirmEmail);
router.route("/admin").get(auth, admin, getAllUsers);
router.route("/admin/expiry-groups").get(auth, admin, getUsersByExpiryDate);
router.route("/admin/send-expiry-email").post(auth, admin, sendExpiryReminderEmail);
router.route("/admin/send-bulk-expiry-emails").post(auth, admin, sendBulkExpiryReminderEmails);

// Send bulk custom emails to multiple recipients
router.route("/admin/bulk-email").post(auth, admin, sendBulkCustomEmails);

// Grant access endpoints
router.route("/admin/grant-manager-access").post(auth, admin, grantManagerAccess);
router.route("/admin/grant-team-access").post(auth, admin, grantTeamAccess);

// Revoke access endpoints
router.route("/admin/revoke-manager-access").post(auth, admin, revokeManagerAccess);
router.route("/admin/revoke-team-access").post(auth, admin, revokeTeamAccess);

// Test email service endpoint
router.post("/admin/test-email", auth, admin, async (req, res) => {
  try {
    const { sendEmail } = await import("../utils/email.js");
    console.log("Testing email service...");
    
    const result = await sendEmail(
      "test@example.com", 
      "<h1>Test Email</h1><p>This is a test email from PilotShala.</p>", 
      "Test Email Service"
    );
    
    console.log("Email test result:", result);
    
    res.json({ 
      success: result, 
      message: result ? "Test email sent successfully" : "Test email failed",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Email test error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
router.route("/logout").get(logout);
router.route("/cookie").post(getCookie);
router.route("/hide-walkthrough").get(auth, hideWalkthrough);
router.route("/subscription").get(auth, getSubscriptionDetails);
router
  .route("/plan")
  .put(auth, admin, changeUserPlan)
  .delete(auth, admin, suspendUserPlan);
router.route("/plan/free").post(auth, admin, addFreeAccess);
router.route("/plan/extend").post(auth, admin, extendUserPlan);

// Password Reset Routes
router.route("/forgot-password").post(sendPasswordResetOtp);
router.route("/verify-reset-otp").post(verifyPasswordResetOtp);
router.route("/reset-password").post(resetPassword);

router.route("/:id").delete(auth, admin, deleteUser).put(auth, admin, editUser);
//   router
//     .route("/image")
//     .post(auth, handleMultipleImageUpload("profile"), updateImage);
// router.route("/auth/token").get(loginWithToken);

export default router;
