import express from "express";
import {
  getAdminStats,
  getLiveStats,
  heartbeat,
  getHourlyAnalytics,
  getMultiDayHourlyAnalytics,
  getCurrentHourAnalytics,
  getActualHourlyActiveUsersAnalytics,
  recalculateHourlyActiveUsersAnalytics,
  getActiveUsersAnalytics,
} from "../controllers/analytics.js";
import { admin, auth } from "../middleware/auth.js";

const router = express.Router();

router.route("/live").get(getLiveStats);
router.route("/actual-hourly-active-users").get(getActualHourlyActiveUsersAnalytics);
router.route("/heartbeat").get(heartbeat);
router.route("/admin").get(auth, admin, getAdminStats);
router.route("/recalculate-hourly-active-users").get(recalculateHourlyActiveUsersAnalytics);

// New hourly analytics routes
router.route("/hourly").get(getHourlyAnalytics);
router.route("/hourly/multi-day").get(getMultiDayHourlyAnalytics);
router.route("/hourly/current").get(getCurrentHourAnalytics);

// Multi-period active users analytics
router.route("/active-users").get(getActiveUsersAnalytics);

export default router;
