import express from "express";
import { admin, auth } from "../middleware/auth.js";
import {
  createPlan,
  getPlans,
  subscribePlan,
  cancelPlan,
  updatePlan,
  deletePlan,
  getActivePlans,
  pauseSubscription,
  resumeSubscription,
  cancelAutoRenewal,
  manualRenewSubscription,
  getSubscriptionStatus,
  confirmRazorpayPayment,
} from "../controllers/plan.js";

const router = express.Router();

router.route("/").post(auth, admin, createPlan).get(auth, admin, getPlans);
router.route("/public").get(getActivePlans);
router.route("/cancel").get(auth, cancelPlan);
router
  .route("/:id")
  .put(auth, admin, updatePlan)
  .delete(auth, admin, deletePlan);
router.route("/:id/subscribe").get(auth, subscribePlan);
router.route("/renew").post(auth, manualRenewSubscription);
router.route("/pause").get(auth, pauseSubscription);
router.route("/resume").get(auth, resumeSubscription);
router.route("/cancel-auto-renewal").get(auth, cancelAutoRenewal);
router.route("/status").get(auth, getSubscriptionStatus);
router.route("/confirm-razorpay").post(auth, confirmRazorpayPayment);

router.route("/test-auto-renewal").get(auth, (req, res) => {
  try {
    const user = req.user;
    res.json({
      message: "Test endpoint working",
      user: {
        id: user._id,
        subscription: user.subscription,
        razorpay: user.razorpay
      }
    });
  } catch (error: any) {
    console.error("Test endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
