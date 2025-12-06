import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getPracticeBooks,
  getPracticeQuestions,
  getPracticeSubjects,
  getPracticeTopics,
  getUserPracticeStatus,
  completeTopicPractice,
  getCompletedTopics,
  toggleTopicCompletion,
} from "../controllers/practice.js";

const router = express.Router();

router.route("/subjects").get(auth, getPracticeSubjects);
router.route("/books").get(auth, getPracticeBooks);
router.route("/topics").get(auth, getPracticeTopics);
router.route("/questions").get(auth, getPracticeQuestions);
router.route("/status").get(auth, getUserPracticeStatus);
router.route("/complete-topic").post(auth, completeTopicPractice);
router.route("/completed-topics").get(auth, getCompletedTopics);
router.route("/toggle-completion").post(auth, toggleTopicCompletion);

export default router;
