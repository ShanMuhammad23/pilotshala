import { Request, Response } from "express";
// Removed fs usage; all data is now fetched from DB
import { Question } from "../models/index.js";

// Helper function to check if user is on free plan
const isFreeUser = (user: any): boolean => {
  return !user.subscription?.plan || user.subscription?.free === true;
};

// Helper function to get available subjects for free users
const getAvailableSubjectsForFreeUser = (allSubjects: string[]): string[] => {
  // Free users can only access the first 2 subjects from the sorted order
  const firstTwoSubjects = allSubjects.slice(0, 2);
  
  // Always include "Color Blind Test" for free users if it exists
  const colorBlindTest = "Color Blind Test";
  if (allSubjects.includes(colorBlindTest) && !firstTwoSubjects.includes(colorBlindTest)) {
    firstTwoSubjects.push(colorBlindTest);
  }
  
  return firstTwoSubjects;
};

// Helper function to sort subjects in specific order
const sortSubjectsInOrder = (subjects: string[]): string[] => {
  const subjectOrder = [
    "Meteorology",
    "Regulations",
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
    const allSubjects = (await Question.distinct("subject"))
    // Sort subjects in the specified order
    const sortedSubjects = sortSubjectsInOrder(allSubjects);
    
    if (freeUser) {
      // For free users, return all subjects with availability info
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
      // For paid users, return all subjects as available
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

    // Free-user gating based on DB subjects
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error:
            "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }

    // Fetch books from DB only
    const books: string[] = await Question.distinct("book", { subject });

    // Check if there are questions without a book for this subject
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
    console.log("Error loading books:", error);
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

    // Free-user gating based on DB subjects
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error:
            "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }

    // Fetch topics from DB only
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
    console.log("Error loading topics:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const getAllPracticeTopics = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // Fetch subjects, books, topics and combinations from database only
    const dbSubjects = (await Question.distinct("subject"))

    // Get unique subject-book-topic combinations from database
    const dbSubjectBookTopicCombinations = await Question.aggregate([
      {
        $match: {
          subject: { $nin: [""] }
        }
      },
      {
        $group: {
          _id: {
            subject: "$subject",
            book: "$book",
            topic: "$topic"
          }
        }
      },
      {
        $project: {
          _id: 0,
          subject: "$_id.subject",
          book: "$_id.book",
          topic: "$_id.topic"
        }
      }
    ]);

    const dbTopicsBySubjectBook: { [key: string]: string[] } = {};
    dbSubjectBookTopicCombinations.forEach((item: any) => {
      // Handle empty book/topic values by using "others" as the key
      const bookKey = item.book && item.book.trim() !== "" ? item.book : "others";
      const topicKey = item.topic && item.topic.trim() !== "" ? item.topic : "others";
      const key = `topics_${item.subject}_${bookKey}`;
      
      if (!dbTopicsBySubjectBook[key]) {
        dbTopicsBySubjectBook[key] = [];
      }
      if (!dbTopicsBySubjectBook[key].includes(topicKey)) {
        dbTopicsBySubjectBook[key].push(topicKey);
      }
    });

    // Get unique books for each subject from database
    const dbBooksBySubject: { [key: string]: string[] } = {};
    dbSubjectBookTopicCombinations.forEach((item: any) => {
        const key = `books_${item.subject}`;
        if (!dbBooksBySubject[key]) {
          dbBooksBySubject[key] = [];
        }
        // Handle empty book values by using "others"
        const bookValue = item.book && item.book.trim() !== "" ? item.book : "others";
        if (!dbBooksBySubject[key].includes(bookValue)) {
          dbBooksBySubject[key].push(bookValue);
        }
    });

    // Build merged-like data entirely from DB
    // Sort subjects in the specified order
    const sortedSubjects = sortSubjectsInOrder(dbSubjects);
    
    const mergedData: any = {
      subjects: sortedSubjects,
    };

    // Merge books for each subject
    Object.keys(dbBooksBySubject).forEach(key => {
      const existingBooks = mergedData[key] || [];
      mergedData[key] = [...new Set([...existingBooks, ...dbBooksBySubject[key]])];
    });

    // Merge topics for each subject-book combination
    Object.keys(dbTopicsBySubjectBook).forEach(key => {
      const existingTopics = mergedData[key] || [];
      mergedData[key] = [...new Set([...existingTopics, ...dbTopicsBySubjectBook[key]])];
    });

    return res.status(200).json(mergedData);
  } catch (error: any) {
    console.log("Error loading practice topics:", error);
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

    // Free-user gating based on DB subjects
    if (freeUser) {
      const allSubjects: string[] = await Question.distinct("subject");
      const sortedSubjects = sortSubjectsInOrder(allSubjects);
      const filteredSubjects = sortedSubjects.filter(
        (s: string) => s !== "Regulations"
      );
      const availableSubjects = getAvailableSubjectsForFreeUser(filteredSubjects);
      if (!availableSubjects.includes(subject as string)) {
        return res.status(403).json({
          error:
            "This subject is not available for free users. Please subscribe to a plan to access all subjects.",
          requiresSubscription: true,
        });
      }
    }

    // Fetch questions from DB only
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
        $expr: { $gte: [{ $size: "$choices" }, 2] },
      });
    } else if (book === "others") {
      questions = await Question.find({
        subject,
        $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
        topic,
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 2] },
      });
    } else if (topic === "others") {
      questions = await Question.find({
        subject,
        book,
        $or: [{ topic: { $exists: false } }, { topic: "" }, { topic: null }],
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 2] },
      });
    } else {
      questions = await Question.find({
        subject,
        book,
        topic,
        choices: { $exists: true, $type: "array" },
        $expr: { $gte: [{ $size: "$choices" }, 2] },
      });
    }

    return res.status(200).json(questions || []);
  } catch (error: any) {
    console.log("Error loading questions:", error);
    return res.status(400).json({ error: error?.message });
  }
};
