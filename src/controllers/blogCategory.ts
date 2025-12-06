import { Request, Response } from "express";
import { BlogCategory } from "../models/index.js";

export const getBlogCategories = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const categories = await BlogCategory.find().sort({ name: 1 });
    return res.json(categories);
  } catch (error) {
    console.error("Get Blog Categories Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch categories" });
  }
};

export const addBlogCategory = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { name } = req.body;
    const category = await BlogCategory.create({ name });
    return res.status(201).json(category);
  } catch (error) {
    console.error("Create Blog Category Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create category" });
  }
};

export const deleteBlogCategory = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const category = await BlogCategory.findByIdAndDelete(id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    return res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Blog Category Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete category" });
  }
};
