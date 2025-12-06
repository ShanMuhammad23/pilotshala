import express from "express";
import { admin, auth } from "../middleware/auth.js";
import { getPayments, getPaymentsByUserId } from "../controllers/payment.js";

const router = express.Router();

router.route("/").get(auth, getPayments);
router.route("/user/:id").get(auth, getPaymentsByUserId);

export default router;
