import { Request, Response } from "express";
import { Question, TopicCompletion } from "../models/index.js";


const hasActivePaidSubscription = (user: any): boolean => {
  return user.subscription && 
         user.subscription.free === false && 
         user.subscription.status === "active";
};


const isFreeUser = (user: any): boolean => {

  return !user.subscription || 
         user.subscription.free === true || 
         user.subscription.status !== "active";
};


const getAvailableSubjectsForFreeUser = (allSubjects: string[]): string[] => {
  // Free users can only access the first 2 subjects
  const firstTwoSubjects = allSubjects.slice(0, 2);
  
  // Always include "Color Blind Test" for free users if it exists
  const colorBlindTest = "Color Blind Test";
  if (allSubjects.includes(colorBlindTest) && !firstTwoSubjects.includes(colorBlindTest)) {
    firstTwoSubjects.push(colorBlindTest);
  }
  
  return firstTwoSubjects;
};


const sortSubjectsInOrder = (subjects: string[]): string[] => {
  const subjectOrder = [
    "Meteorology", 
    "Navigation",
    "Radio Navigation",
    "Instruments",
    "Performance",
    "Technical",
    "Technical Specific",
    "RTR",
    "Color Blind Test"
  ];
  
  return subjects.sort((a, b) => {
    const indexA = subjectOrder.indexOf(a);
    const indexB = subjectOrder.indexOf(b);
    
    // If both subjects are in the order array, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the order array, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in the order array, maintain original order
    return 0;
  });
};


export const getPracticeSubjects = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const freeUser = isFreeUser(user);
    
    // Fetch subjects from DB only
    const allSubjects = (await Question.distinct("subject")).filter(
      (subject: string) => subject !== "Regulations"
    );
    if (!allSubjects) {
      return res.status(404).json({ error: "Subjects not found" });
    }
    
    const sortedSubjects = sortSubjectsInOrder(allSubjects);
    
    if (freeUser) {
      const availableSubjects = getAvailableSubjectsForFreeUser(sortedSubjects);
      const subjectsWithStatus = sortedSubjects.map((subject: string) => ({
        name: subject,
        available: availableSubjects.includes(subject),
        locked: !availableSubjects.includes(subject),
      }));
      
      return res.status(200).json({
        subjects: subjectsWithStatus,
        freeUser: true,
        availableCount: availableSubjects.length,
        totalCount: sortedSubjects.length,
      });
    } else {
      const subjectsWithStatus = sortedSubjects.map((subject: string) => ({
        name: subject,
        available: true,
        locked: false,
      }));
      
      return res.status(200).json({
        subjects: subjectsWithStatus,
        freeUser: false,
        availableCount: sortedSubjects.length,
        totalCount: sortedSubjects.length,
      });
    }
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getPracticeBooks = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { subject } = req.query;
    const freeUser = isFreeUser(user);
    
    // Free-user gating via DB subjects
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error: "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }
    
    // DB only
    const books: string[] = await Question.distinct("book", { subject });

    const questionsWithoutBook = await Question.find({
      subject,
      $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
      choices: { $exists: true, $type: "array" },
      $expr: { $gte: [{ $size: "$choices" }, 2] },
    }).limit(1);

    if (questionsWithoutBook.length > 0) {
      books.push("others");
    }

    return res
      .status(200)
      .json(books.filter((book: string) => (book && book?.trim() !== "" ? true : false)) || []);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getPracticeTopics = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { subject, book } = req.query;
    const freeUser = isFreeUser(user);
    
    // Free-user gating via DB subjects
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error: "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }
    
    // DB only
    let topics: string[] = [];
    if (book === "others") {
      topics = await Question.distinct("topic", {
        subject,
        $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
      });
    } else {
      topics = await Question.distinct("topic", { subject, book });
    }

    return res
      .status(200)
      .json(topics.filter((topic: string) => topic?.trim() !== "") || []);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getPracticeQuestions = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const { subject, book, topic } = req.query;
    const freeUser = isFreeUser(user);
    
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error: "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }
    
    // DB only
    let questions: any[] = [];
    
    if (book === "others" && topic === "others") {
      questions = await Question.find({
        subject,
        $and: [
          {
            $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
          },
          {
            $or: [
              { topic: { $exists: false } },
              { topic: "" },
              { topic: null },
            ],
          },
        ],
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 1] },
      });
    } else if (book === "others") {
      questions = await Question.find({
        subject,
        $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
        topic,
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 1] },
      });
    } else if (topic === "others") {
      questions = await Question.find({
        subject,
        book,
        $or: [{ topic: { $exists: false } }, { topic: "" }, { topic: null }],
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 1] },
      });
    } else {
      questions = await Question.find({
        subject,
        book,
        topic,
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 1] },
      });
    }

    return res.status(200).json(questions || []);
  } catch (error: any) {
    console.log("Error loading questions:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const getUserPracticeStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user;
    const freeUser = isFreeUser(user);
    
    // Get all subjects from DB only
    let allSubjects: string[] = (await Question.distinct("subject")).filter(
      (subject: string) => subject !== "Regulations"
    );
    
    // Sort subjects in the specified order
    const sortedSubjects = sortSubjectsInOrder(allSubjects);
    
    if (freeUser) {
      const availableSubjects = getAvailableSubjectsForFreeUser(sortedSubjects);
      const lockedSubjects = sortedSubjects.filter(subject => !availableSubjects.includes(subject));
      
      return res.status(200).json({
        freeUser: true,
        availableSubjects,
        lockedSubjects,
        totalSubjects: sortedSubjects.length,
        availableCount: availableSubjects.length,
        subjectLimit: 2,
        requiresSubscription: true,
      });
    } else {
      return res.status(200).json({
        freeUser: false,
        availableSubjects: sortedSubjects,
        lockedSubjects: [],
        totalSubjects: sortedSubjects.length,
        availableCount: sortedSubjects.length,
        subjectLimit: null,
        requiresSubscription: false,
      });
    }
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const completeTopicPractice = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user._id;
    const {
      subject,
      book,
      topic,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      unattempted = 0,
      score,
    } = req.body;

    // Validation
    if (
      !subject ||
      !book ||
      !topic ||
      totalQuestions === undefined ||
      correctAnswers === undefined ||
      incorrectAnswers === undefined ||
      score === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate score range
    if (score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 0 and 100",
      });
    }

    // Validate question counts
    if (totalQuestions !== correctAnswers + incorrectAnswers + unattempted) {
      return res.status(400).json({
        success: false,
        message: "Total questions must equal correct + incorrect + unattempted answers",
      });
    }

    // Find existing completion or create new one
    const completion = await TopicCompletion.findOneAndUpdate(
      { userId, subject, book, topic },
      {
        $set: {
          score,
          totalQuestions,
          correctAnswers,
          incorrectAnswers,
          unattempted,
          isManuallyMarked: false,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        $inc: { attempts: 1 },
        $setOnInsert: { userId, subject, book, topic, createdAt: new Date() },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Topic completion saved successfully",
      data: completion,
    });
  } catch (error: any) {
    console.error("Error saving topic completion:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getCompletedTopics = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user._id;

    const completions = await TopicCompletion.find({ userId })
      .sort({ completedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: completions,
    });
  } catch (error: any) {
    console.error("Error fetching completed topics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const toggleTopicCompletion = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user._id;
    const { subject, book, topic, isCompleted } = req.body;

    // Validation
    if (!subject || !book || !topic || isCompleted === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (isCompleted) {
      // Mark as completed
      const completion = await TopicCompletion.findOneAndUpdate(
        { userId, subject, book, topic },
        {
          $set: {
            isManuallyMarked: true,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            userId,
            subject,
            book,
            topic,
            score: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            unattempted: 0,
            attempts: 0,
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Topic marked as completed",
        data: completion,
      });
    } else {
      // Mark as incomplete - delete the record
      await TopicCompletion.deleteOne({ userId, subject, book, topic });

      return res.status(200).json({
        success: true,
        message: "Topic marked as incomplete",
        data: null,
      });
    }
  } catch (error: any) {
    console.error("Error toggling topic completion:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
