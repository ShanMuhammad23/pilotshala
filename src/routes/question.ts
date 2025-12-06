import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  createQuestions,
  getSubjectsList,
  getBooksList,
  getTopicsList,
  testUpdateQuestion,
  healthCheck,
} from "../controllers/question.js";
import express from "express";
import { admin, auth } from "../middleware/auth.js";
//   import handleMultipleImageUpload from "../middleware/s3.js";

const router = express.Router();

router
  .route("/")
  .post(auth, admin, createQuestion)
  .get(auth, admin, getQuestions);
router.route("/multiple").post(auth, admin, createQuestions);
router.route("/subjects").get(getSubjectsList);
router.route("/books").get(getBooksList);
router.route("/topics").get(getTopicsList);
router.route("/health").get(healthCheck);
router
  .route("/:id")
  .get(auth, admin, getQuestionById)
  .put(auth, admin, updateQuestion)
  .delete(auth, admin, deleteQuestion);

// Test endpoint for debugging
router.route("/test/:id").put(auth, admin, testUpdateQuestion);

//   router
//     .route("/image")
//     .post(auth, handleMultipleImageUpload("profile"), updateImage);
// router.route("/auth/token").get(loginWithToken);

export default router;
