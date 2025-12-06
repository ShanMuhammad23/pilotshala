import mongoose from "mongoose";
import { Request, Response } from "express";
import { Question } from "../models/index.js";
import { groupSubjectsForDisplay, getSubSubjects } from "../utils/constants.js";

// Create a new question
export const createQuestion = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const question = new Question(req.body);
    const savedQuestion = await question.save();
    return res.status(201).json(savedQuestion);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

// Create a new question
export const createQuestions = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const questions = req.body.questions;
    const newQuestions = await Question.insertMany(questions);
    return res.status(201).json(newQuestions);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

// Get all questions
export const getQuestions = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { page, pageSize, searchQuery, subject, book } = req.query;

    const limit = pageSize ? parseInt(pageSize as string) : 20;
    const skip = page ? (parseInt(page as string) - 1) * limit : 0;

    const filters: any = {};
    if (subject !== "all") {
      filters.subject = subject;
    }
    if (book !== "all") {
      filters.book = book;
    }

    const search = {
      $or: [
        { idStr: { $regex: searchQuery, $options: "i" } },
        { question: { $regex: searchQuery, $options: "i" } },
        { answer: { $regex: searchQuery, $options: "i" } },
        { subject: { $regex: searchQuery, $options: "i" } },
      ],
    };

    const results = await Question.aggregate([
      {
        $addFields: {
          idStr: { $toString: "$_id" },
        },
      },
      {
        $match: {
          $and: [search, filters],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          total: [{ $count: "count" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const questions = results[0].data;
    const total = results[0].total[0]?.count || 0;
    const pages = Math.ceil(total / limit);

    return res.status(200).json({ questions, total, pages });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error?.message });
  }
};

// Get a single question by ID
export const getQuestionById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    return res.status(200).json(question);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message });
  }
};

// Update a question by ID
export const updateQuestion = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    
    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid question ID format" });
    }

    // Log the incoming data for debugging
    console.log("Update request for question ID:", id);
    console.log("Update data:", JSON.stringify(req.body, null, 2));

    // Check if the question exists before updating
    const existingQuestion = await Question.findById(id);
    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    console.log("Existing question:", JSON.stringify(existingQuestion.toObject(), null, 2));

    // Validate the update data
    const updateData = { ...req.body };
    
    // Ensure choices array is properly formatted if provided
    if (updateData.choices && Array.isArray(updateData.choices)) {
      updateData.choices = updateData.choices.map((choice: any) => ({
        isCorrect: Boolean(choice.isCorrect),
        choice: String(choice.choice || '')
      }));
    }

    // Perform the update with better error handling
    const updatedQuestion = await Question.findByIdAndUpdate(
      id, 
      updateData, 
      {
        new: true,
        runValidators: true,
        upsert: false
      }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    console.log("Question updated successfully:", updatedQuestion._id);
    console.log("Updated question data:", JSON.stringify(updatedQuestion.toObject(), null, 2));
    
    return res.status(200).json({
      message: "Question updated successfully",
      question: updatedQuestion
    });
  } catch (error: any) {
    console.error("Error updating question:", error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: "Invalid data format" });
    }
    
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

// Test endpoint to debug update issues
export const testUpdateQuestion = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    
    console.log("Test update request for question ID:", id);
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers);
    
    // Just return the request data for debugging
    return res.status(200).json({
      message: "Test endpoint reached",
      id,
      body: req.body,
      headers: req.headers
    });
  } catch (error: any) {
    console.error("Test update error:", error);
    return res.status(500).json({ error: error?.message });
  }
};

// Health check endpoint for debugging
export const healthCheck = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // Test database connection
    const questionCount = await Question.countDocuments();
    
    return res.status(200).json({
      message: "Database connection successful",
      questionCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return res.status(500).json({ 
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Delete a question by ID
export const deleteQuestion = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const deletedQuestion = await Question.findByIdAndDelete(id);
    if (!deletedQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }
    return res.status(200).json({ message: "Question deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message });
  }
};

export const getSubjectsList = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const subjects = await Question.distinct("subject");
    if (!subjects) return res.status(404).json({ error: "Subjects not found" });
    
    // Group navigation sub-subjects under "Navigation"
    const groupedSubjects = groupSubjectsForDisplay(subjects);
    
    return res.status(200).json(groupedSubjects);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getBooksList = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { subject } = req.query;
    let books: string[] = [];
    
    if (subject === "Navigation") {
      // For Navigation, get books from all navigation sub-subjects
      const navigationSubjects = getSubSubjects("Navigation");
      for (const subSubject of navigationSubjects) {
        const subBooks = await Question.distinct("book", { subject: subSubject });
        books = [...books, ...subBooks];
      }
      // Remove duplicates
      books = [...new Set(books)];
    } else {
      // For other subjects, get books normally
      books = await Question.distinct("book", { subject });
    }
    
    return res
      .status(200)
      .json(books.filter((book) => book?.trim() !== "") || []);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getTopicsList = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { subject, book } = req.query;
    let topics: string[] = [];
    
    if (subject === "Navigation") {
      // For Navigation, get topics from all navigation sub-subjects
      const navigationSubjects = getSubSubjects("Navigation");
      for (const subSubject of navigationSubjects) {
        if (book === "others") {
          const subTopics = await Question.distinct("topic", {
            subject: subSubject,
            $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
          });
          topics = [...topics, ...subTopics];
        } else {
          const subTopics = await Question.distinct("topic", { subject: subSubject, book });
          topics = [...topics, ...subTopics];
        }
      }
      // Remove duplicates
      topics = [...new Set(topics)];
    } else {
      // For other subjects, get topics normally
      if (book === "others") {
        topics = await Question.distinct("topic", {
          subject,
          $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
        });
      } else {
        topics = await Question.distinct("topic", { subject, book });
      }
    }
    
    return res
      .status(200)
      .json(topics.filter((topic) => topic?.trim() !== "") || []);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};
