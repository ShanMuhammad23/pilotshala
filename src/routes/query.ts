import express from "express";
import { admin, auth } from "../middleware/auth.js";
import {
  getQueries,
  markQueryAsRead,
  replyToQuery,
  sendQuery,
  deleteQuery,
} from "../controllers/query.js";

const router = express.Router();

router.route("/").get(auth, admin, getQueries).post(sendQuery);
router.route("/:id").put(auth, admin, markQueryAsRead).delete(auth, admin, deleteQuery);
router.route("/reply/:id").post(auth, admin, replyToQuery);

export default router;
