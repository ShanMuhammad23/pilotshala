import express from "express";
import { admin, auth } from "../middleware/auth.js";
import {
  createTestimonial,
  deleteTestimonial,
  getTestimonials,
  updateTestimonial,
} from "../controllers/testimonial.js";

const router = express.Router();

router.route("/").get(getTestimonials).post(auth, admin, createTestimonial);
router
  .route("/:id")
  .delete(auth, admin, deleteTestimonial)
  .put(auth, admin, updateTestimonial);

export default router;
