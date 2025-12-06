import { Question } from "./models/index.js";
import fs from "fs";

/**
 * Helper function to sort subjects in specific order
 * @param subjects - Array of subjects to sort
 * @returns Array of subjects sorted in the specified order
 */
const sortSubjectsInOrder = (subjects: string[]): string[] => {
  const subjectOrder = [
    "Meteorology",
    "Regulations", 
    "Navigation",
    "Radio Navigation",
    "Instruments",
    "Performance",
    "Technical",
    "Technical Specific"
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

const getPracticeSubjects = async () => {
  try {
    const subjects = (await Question.distinct("subject")) as string[];
    if (!subjects) return null;
    
    // Sort subjects in the specified order instead of alphabetical
    return sortSubjectsInOrder(subjects);
  } catch (error: any) {
    return null;
  }
};

const getPracticeBooks = async (subject: string) => {
  try {
    // For practice, treat all subjects individually (no grouping)
    const books = await Question.distinct("book", { subject });
    
    const questionsWithoutBook = await Question.find({
      subject,
      $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
      choices: { $exists: true, $type: "array" },
      $expr: { $gte: [{ $size: "$choices" }, 2] },
    });

    if (questionsWithoutBook.length > 0) books.push("others");

    return (
      books.filter((book) => (book && book?.trim() !== "" ? true : false)) || []
    );
  } catch (error: any) {
    return null;
  }
};

const getPracticeTopics = async (subject: string, book: string) => {
  try {
    // For practice, treat all subjects individually (no grouping)
    let topics: string[] = [];
    if (book === "others") {
      topics = await Question.distinct("topic", {
        subject,
        $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
      });
    } else {
      topics = await Question.distinct("topic", { subject, book });
    }
    
    return topics.filter((topic) => topic?.trim() !== "") || [];
  } catch (error: any) {
    return null;
  }
};

const getPracticeQuestions = async (
  subject: string,
  book: string,
  topic: string
): Promise<any> => {
  try {
    // For practice, treat all subjects individually (no grouping)
    let questions: any[] = [];
    
    if (book === "others") {
      questions = await Question.find({
        subject,
        $or: [{ book: { $exists: false } }, { book: "" }, { book: null }],
        topic,
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
    
    return questions;
  } catch (error: any) {
    return null;
  }
};

export const createPracticeCache = async () => {
  try {
    let obj: any = {};
    const subjects = await getPracticeSubjects();

    if (subjects) {
      obj["subjects"] = subjects;
      for (let subject of subjects) {
        const books = await getPracticeBooks(subject as string);
        if (books) {
          obj[`books_${subject}`] = books;
          for (let book of books) {
            const topics = await getPracticeTopics(
              subject as string,
              book as string
            );
            if (topics) {
              obj[`topics_${subject}_${book}`] = topics;
            }
          }
        }
      }
      fs.writeFileSync(
        "./static/practice_topics_cache.json",
        JSON.stringify(obj)
      );
    }

    if (subjects) {
      for (let subject of subjects) {
        const books = await getPracticeBooks(subject as string);
        if (books) {
          for (let book of books) {
            const topics = await getPracticeTopics(
              subject as string,
              book as string
            );
            if (topics) {
              for (let topic of topics) {
                const questions = await getPracticeQuestions(
                  subject as string,
                  book as string,
                  topic as string
                );
                if (questions) {
                  fs.writeFileSync(
                    `./static/questions_${subject}_${book}_${topic?.replaceAll("/", "-")}.json`,
                    JSON.stringify(questions)
                  );
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error creating practice cache:", error);
  }
};
