import express from "express";
import {
  getBlogCategories,
  addBlogCategory,
  deleteBlogCategory,
} from "../controllers/blogCategory.js";
import {
  deleteBlog,
  getAllBlogs,
  getBlog,
  getPublishedBlogs,
  markBlogAsFeatured,
  createBlog,
  updateBlog,
  getPublicBlog,
  publishScheduledBlogs,
} from "../controllers/blog.js";
import { admin, auth } from "../middleware/auth.js";

const router = express.Router();

// Get all blog categories
router.route("/").post(auth, admin, createBlog).get(auth, admin, getAllBlogs);
router.route("/public").get(getPublishedBlogs);
router.route("/public/:slug").get(getPublicBlog);
router
  .route("/categories")
  .get(getBlogCategories)
  .post(auth, admin, addBlogCategory);
router.route("/categories/:id").delete(auth, admin, deleteBlogCategory);
router
  .route("/:id")
  .get(getBlog)
  .delete(auth, admin, deleteBlog)
  .put(auth, admin, updateBlog);
router.route("/:id/featured").post(auth, admin, markBlogAsFeatured);
router.route("/publish-scheduled").post(auth, admin, async (req, res) => {
  try {
    await publishScheduledBlogs();
    res.json({ success: true, message: "Scheduled blogs published successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to publish scheduled blogs" });
  }
});

export default router;
