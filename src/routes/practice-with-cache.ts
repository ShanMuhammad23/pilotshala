import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getAllPracticeTopics,
  getPracticeBooks,
  getPracticeQuestions,
  getPracticeSubjects,
  getPracticeTopics,
} from "../controllers/practice-with-cache.js";

const router = express.Router();

router.route("/subjects").get(auth, getPracticeSubjects);
router.route("/books").get(auth, getPracticeBooks);
router.route("/topics").get(auth, getPracticeTopics);
router.route("/all-topics").get(auth, getAllPracticeTopics);
router.route("/questions").get(auth, getPracticeQuestions);

export default router;
