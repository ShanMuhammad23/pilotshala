import { Request, Response } from "express";
import { Testimonial } from "../models/index.js";

export const createTestimonial = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const testimonial = new Testimonial(req.body);
    const savedTestimonial = await testimonial.save();
    return res.status(201).json(savedTestimonial);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getTestimonials = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    return res.status(200).json(testimonials);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const deleteTestimonial = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const testimonial = await Testimonial.findByIdAndDelete(id);
    if (!testimonial) {
      return res.status(404).json({ error: "Testimonial not found" });
    }
    return res
      .status(200)
      .json({ message: "Testimonial deleted successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const updateTestimonial = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedTestimonial) {
      return res.status(404).json({ error: "Testimonial not found" });
    }
    return res.status(200).json(updatedTestimonial);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};
