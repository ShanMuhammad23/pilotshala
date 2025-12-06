import express from "express";
import { deleteImage, getImages, uploadImage } from "../controllers/media.js";
import { upload } from "../middleware/multer.js";
import { auth, admin } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/images")
  .get(auth, admin, getImages)
  .post(auth, admin, upload.single("image"), uploadImage);

router.route("/images/:id").delete(auth, admin, deleteImage);
export default router;
