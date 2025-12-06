import {
  createNewExam,
  deleteExam,
  finishExam,
  getExamById,
  getExams,
  getExamsAnalytics,
  getRankings,
  startExam,
  submitAnswer,
  updateTimers,
  getUserExamStatus,
  getUserSubjectDetails,
} from "../controllers/exam.js";
import express from "express";
import { admin, auth } from "../middleware/auth.js";
//   import handleMultipleImageUpload from "../middleware/s3.js";

const router = express.Router();

router.route("/").get(auth, getExams).post(auth, createNewExam);
router.route("/analytics").get(auth, getExamsAnalytics);
router.route("/ranking").get(getRankings);
router.route("/status").get(auth, getUserExamStatus);
router.route("/user/:userId/subject/:subject").get(auth, getUserSubjectDetails);
router.route("/:id").get(auth, getExamById).delete(auth, deleteExam);
router.route("/:id/start").get(auth, startExam);
router.route("/:id/answer").post(auth, submitAnswer);
router.route("/:id/timers").post(auth, updateTimers);
router.route("/:id/finish").get(auth, finishExam);

//   router
//     .route("/image")
//     .post(auth, handleMultipleImageUpload("profile"), updateImage);
// router.route("/auth/token").get(loginWithToken);

export default router;
