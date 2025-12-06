import { Request, Response } from "express";
import { Exam, Question, User } from "../models/index.js";
import { getMainSubject, getSubSubjects } from "../utils/constants.js";
import fs from "fs";
import path from "path";

// Helper function to check if user is on free plan
const isFreeUser = (user: any): boolean => {
  return !user.subscription?.plan || user.subscription?.free === true;
};

// Helper function to check if user can create more exams
const canUserCreateExam = async (user: any): Promise<{ canCreate: boolean; reason?: string }> => {
  // Admin users can always create exams
  if (user.isAdmin) {
    return { canCreate: true };
  }

  // Users with active subscription can create unlimited exams
  if (user.subscription?.status === "active" && !user.subscription?.free) {
    return { canCreate: true };
  }

  // Free users are limited to 2 exams
  if (isFreeUser(user)) {
    const totalExams = await Exam.countDocuments({ user: user._id });
    if (totalExams >= 2) {
      return { 
        canCreate: false, 
        reason: "You have reached the maximum limit of 2 exams for free users. Please subscribe to a plan to take more exams." 
      };
    }
    return { canCreate: true };
  }

  // Users without any subscription cannot create exams
  return { 
    canCreate: false, 
    reason: "You need to purchase a plan to create an exam. Go to Subscription page." 
  };
};

export const getExamConditional = (exam: any) => {
  if (!exam) return null;

  exam = exam.toObject();

  if (!exam.isStarted) {
    return {
      ...exam,
      questions: exam.questions.map((q: any) => ({ _id: q._id })),
    };
  }
  if (exam.endTime && new Date() > new Date(exam.endTime)) {
    exam.isCompleted = true;
    Exam.findByIdAndUpdate(exam._id, { isCompleted: true });
  }

  if (!exam.isCompleted) {
    return {
      ...exam,
      questions: exam.questions.map((q: any) => ({
        _id: q._id,
        question: q.question,
        choices: q.choices.map((c: any) => ({ choice: c.choice })),
        explanation: q.explanation,
        image: q.image,
      })),
    };
  }

  const total = exam.questions.length;
  const correct = exam.questions.filter((a: any, i: number) => {
    const correct = a.choices.findIndex((o: any) => o.isCorrect);
    return correct === exam.answers[i];
  }).length;
  const unattempted = exam.answers.filter((a: any) => a === -1).length;
  const incorrect = total - correct - unattempted;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    ...exam,
    result: {
      total,
      correct,
      incorrect,
      unattempted,
      score,
    },
  };
};

const completeIncompleteExams = async () => {
  // Find exams that are expired and not completed
  const expiredExams = await Exam.find({
    endTime: { $lt: new Date() },
    isCompleted: false,
  }).populate("questions");
  // Update the isCompleted field for expired exams
  await Promise.all(
    expiredExams.map(async (exam) => {
      exam.isCompleted = true;
      // calculate score
      const total = exam.questions.length;
      const correct = exam.questions.filter((a: any, i: number) => {
        const correct = a.choices.findIndex((o: any) => o.isCorrect);
        return correct === exam.answers[i];
      }).length;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      exam.score = score;
      await exam.save();
    })
  );
};

// const subjects = {
//   Meteorology: { questions: 50, duration: 90 },
//   Regulations: { questions: 50, duration: 90 },
//   Navigation: { questions: 100, duration: 180 },
//   "Radio Navigation": { questions: 100, duration: 180 },
//   Technical: { questions: 100, duration: 180 },
// };

/**
 * Create a new exam
 * 
 * Exam creation rules:
 * - Admin users: Unlimited exams
 * - Paid users with active subscription: Unlimited exams  
 * - Free users: Limited to 2 exams total
 * - Users without subscription: Cannot create exams
 */
export const createNewExam = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;
    const subject = req.body.subject;
    const mainSubject = getMainSubject(subject);

    // check if there is incomplete exam
    const incompleteExam = await Exam.findOne({
      user: user._id,
      isCompleted: false,
    });

    if (incompleteExam) {
      return res.status(400).json({
        error: "You have an incomplete exam. Please complete/submit it first.",
      });
    }

    // Check if user can create more exams
    const examCheck = await canUserCreateExam(user);
    if (!examCheck.canCreate) {
      return res.status(403).json({
        error: examCheck.reason,
        requiresSubscription: true,
      });
    }

    const size =
      mainSubject === "Regulations" || mainSubject === "Meteorology" || mainSubject === "RTR" ? 50 : 100;
    const duration =
      mainSubject === "Regulations" || mainSubject === "Meteorology" ? 90 : mainSubject === "RTR" ? 60 : 180;

    // Build the subject filter
    let subjectFilter: any;
    if (mainSubject === "Navigation") {
      // For Navigation, include all navigation sub-subjects
      const navigationSubjects = getSubSubjects("Navigation");
      subjectFilter = { subject: { $in: navigationSubjects } };
    } else {
      // For other subjects, use the exact subject
      subjectFilter = { subject };
    }

    const questions = await Question.aggregate([
      {
        $match: {
          ...subjectFilter,
          choices: { $exists: true, $type: "array" },
          $expr: { $gte: [{ $size: "$choices" }, 2] },
        },
      },
      { $sample: { size } },
      { $project: { _id: 1 } },
    ]);

    const existingExams = await Exam.find({
      user: user._id,
      subject: mainSubject,
    });

    const exam = new Exam({
      title: `${mainSubject} Exam ${existingExams.length + 1}`,
      subject: mainSubject,
      user: user._id,
      questions: questions.map((question: any) => question._id),
      duration,
      answers: questions.map(() => -1),
      timers: questions.map(() => 15),
    });
    await exam.save();

    return res.status(201).json(exam._id);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getExams = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user;

    // complete expired exams
    await completeIncompleteExams();

    let exams: any = await Exam.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("questions");

    if (!exams) return res.status(404).json({ error: "Exams not found" });
    exams = exams.map(getExamConditional);
    return res.status(200).json(exams);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getExamById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    let exam = await Exam.findById(id)
      .populate("user", "name email")
      .populate("questions");

    if (!exam) return res.status(404).json({ error: "Exam not found" });

    return res.status(200).json(getExamConditional(exam));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const startExam = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id)
      .populate("user", "name email")
      .populate("questions");

    if (!exam) return res.status(404).json({ error: "Exam not found" });
    exam.isStarted = true;
    exam.startTime = new Date();
    exam.endTime = new Date(Date.now() + exam.duration * 60 * 1000 + 1500);
    await exam.save();

    return res.status(200).json(exam);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const submitAnswer = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const { index, choice } = req.body;
    const exam = await Exam.findByIdAndUpdate(
      id,
      {
        isStarted: true,
        startTime: new Date(),
        $set: {
          [`answers.${index}`]: choice,
        },
      },
      { new: true }
    )
      .populate("user", "name email")
      .populate("questions");

    if (!exam) return res.status(404).json({ error: "Exam not found" });

    return res.status(200).json(getExamConditional(exam));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const updateTimers = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const { timers } = req.body;
    const exam = await Exam.findByIdAndUpdate(id, { timers }, { new: true })
      .populate("user", "name email")
      .populate("questions");

    if (!exam) return res.status(404).json({ error: "Exam not found" });

    return res.status(200).json(getExamConditional(exam));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const finishExam = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const exam = await Exam.findByIdAndUpdate(
      id,
      { isCompleted: true, finishTime: new Date() },
      { new: true }
    )
      .populate("user", "name email")
      .populate("questions");

    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const total = exam.questions.length;
    const correct = exam.questions.filter((a: any, i: number) => {
      const correct = a.choices.findIndex((o: any) => o.isCorrect);
      return correct === exam.answers[i];
    }).length;

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    exam.score = score;
    await exam.save();

    return res.status(200).json(getExamConditional(exam));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getExamsAnalytics = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user;

    await completeIncompleteExams();

    let exams = await Exam.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("questions");

    if (!exams) return res.status(404).json({ error: "Exams not found" });

    exams = exams.map(getExamConditional);

    const total = exams.length;
    const completed = exams.filter((exam) => exam.isCompleted).length;
    const unattempted = exams.filter((exam) => !exam.isStarted).length;
    const attempted = total - unattempted;
    const totalScore = exams.reduce((acc: number, exam: any) => {
      if (exam.isCompleted) {
        return acc + (exam.result?.score || 0);
      }
      return acc;
    }, 0);

    const averageScore = totalScore / completed || 0;

    const progress = exams
      .filter((exam) => exam.isCompleted)
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((exam) => ({
        title: exam.title,
        score: exam.score,
        date: exam.startTime,
      }));

    const subjectWiseScores: Record<
      string,
      { total: number; correct: number; score: number }
    > = {};

    exams.forEach((exam: any) => {
      if (!exam.isCompleted || !exam.questions) return;
      exam.questions.forEach((q: any, i: number) => {
        const subject = q.subject || "Unknown";
        if (!subjectWiseScores[subject]) {
          subjectWiseScores[subject] = { total: 0, correct: 0, score: 0 };
        }
        subjectWiseScores[subject].total += 1;
        const correctIndex = q.choices.findIndex((c: any) => c.isCorrect);
        if (exam.answers && exam.answers[i] === correctIndex) {
          subjectWiseScores[subject].correct += 1;
        }
      });
    });

    Object.keys(subjectWiseScores).forEach((subject) => {
      const { total, correct } = subjectWiseScores[subject];
      subjectWiseScores[subject].score = total
        ? Math.round((correct / total) * 100)
        : 0;
    });

    return res.status(200).json({
      total,
      completed,
      unattempted,
      attempted,
      averageScore,
      progress,
      recentExams: exams.filter((exam) => exam.isCompleted).slice(0, 4),
      subjects: Array.from(Object.keys(subjectWiseScores)).map((subject) => ({
        subject,
        ...subjectWiseScores[subject],
      })),
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getRankings = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const cacheFilePath = path.join(process.cwd(), "static", "rankings_cache.json");
    const cacheDir = path.dirname(cacheFilePath);
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Check if cache exists and is valid (less than 15 days old)
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, "utf-8"));
        const cacheDate = new Date(cacheData.timestamp);
        const now = new Date();
        const daysSinceCache = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24);

        // If cache is less than 15 days old, return cached rankings
        if (daysSinceCache < 15) {
          return res.status(200).json({ ranking: cacheData.ranking });
        }
      } catch (error) {
        // If cache file is corrupted, continue to regenerate
        console.error("Error reading rankings cache:", error);
      }
    }

    // Cache expired or doesn't exist - calculate new rankings
    // Find exams that are expired and not completed
    const expiredExams = await Exam.find({
      endTime: { $lt: new Date() },
      isCompleted: false,
    }).populate("questions");

    // Update the isCompleted field for expired exams
    await Promise.all(
      expiredExams.map(async (exam) => {
        exam.isCompleted = true;
        // calculate score
        const total = exam.questions.length;
        const correct = exam.questions.filter((a: any, i: number) => {
          const correct = a.choices.findIndex((o: any) => o.isCorrect);
          return correct === exam.answers[i];
        }).length;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        exam.score = score;
        await exam.save();
      })
    );

    const ranking = await Exam.aggregate([
      {
        $match: {
          isCompleted: true, // only include completed exams
        },
      },
      {
        $group: {
          _id: "$user", // group by user ID
          totalScore: { $avg: "$score" }, // calculate average score
          subjects: { $addToSet: "$subject" }, // collect unique subjects
        },
      },
      {
        $lookup: {
          from: "users", // name of the User collection
          localField: "_id", // user ID from exams
          foreignField: "_id", // user ID in users
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo", // convert array to single object
      },
      {
        $sort: { totalScore: -1 }, // sort by total score descending
      },
      {
        $project: {
          _id: 0,
          userId: "$userInfo._id",
          name: "$userInfo.name", // or whatever fields you want from User
          email: "$userInfo.email",
          profilePicture: "$userInfo.profilePicture",
          totalScore: 1,
          subjects: 1, // include subjects array
        },
      },
    ]);

    // Cache the rankings with current timestamp
    const cacheData = {
      timestamp: new Date().toISOString(),
      ranking: ranking,
    };
    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));

    return res.status(200).json({ ranking });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const deleteExam = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const exam = await Exam.findByIdAndDelete(id);

    if (!exam) return res.status(404).json({ error: "Exam not found" });

    return res.status(200).json({ message: "Exam deleted successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

/**
 * Get user's exam status and limits
 * 
 * Returns:
 * - totalExams: Total number of exams created by user
 * - freeUser: Whether user is on free plan
 * - remainingExams: Number of exams free user can still create (null for paid users)
 * - canCreateExam: Whether user can create a new exam
 * - examLimit: Exam limit for free users (null for paid users)
 * - requiresSubscription: Whether user needs subscription to create more exams
 * - reason: Explanation if user cannot create exams
 */
export const getUserExamStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user;
    
    // Count total exams
    const totalExams = await Exam.countDocuments({
      user: user._id,
    });

    // Check if user is on free plan
    const freeUser = isFreeUser(user);
    
    // Calculate remaining exams for free users
    const remainingExams = freeUser ? Math.max(0, 2 - totalExams) : null;
    const plan = user.subscription?.plan;
    
    // Check if user can create more exams
    const examCheck = await canUserCreateExam(user);

    return res.status(200).json({
      totalExams,
      freeUser,
      remainingExams,
      canCreateExam: examCheck.canCreate,
      examLimit: freeUser ? 2 : null,
      requiresSubscription: !examCheck.canCreate,
      reason: examCheck.reason,
      
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

/**
 * Get detailed subject performance data for a specific user
 * 
 * Authorization:
 * - Admins can view any user's data
 * - Regular users can only view their own data
 * 
 * Returns:
 * - marks: Percentage marks obtained in the subject (0-100)
 * - totalQuestions: Total number of questions attempted
 * - correct: Number of correct answers
 * - incorrect: Number of incorrect answers
 * - unattempted: Number of unattempted questions
 * - subject: Subject name
 * - userId: User ID
 * - examCount: Total number of exams taken in this subject
 * - lastExamDate: Date of last exam taken in this subject
 */
export const getUserSubjectDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, subject } = req.params;
    const currentUser = req.user;

    // Validate parameters
    if (!userId || !subject) {
      return res.status(400).json({
        error: "Invalid userId or subject parameter"
      });
    }

    // Authorization check: Admins can view any user's data, regular users can only view their own
    if (!currentUser.isAdmin && currentUser._id.toString() !== userId) {
      return res.status(403).json({
        error: "You don't have permission to access this resource"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    // Find all completed exams for the user in the specified subject
    const exams = await Exam.find({
      user: userId,
      subject: subject,
      isCompleted: true,
    }).populate("questions");

    // If no exams found, return zero values
    if (!exams || exams.length === 0) {
      return res.status(200).json({
        marks: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        subject: subject,
        userId: userId,
        examCount: 0,
        lastExamDate: null,
      });
    }

    // Aggregate statistics across all exams
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnattempted = 0;

    exams.forEach((exam: any) => {
      if (!exam.questions || !exam.answers) return;

      totalQuestions += exam.questions.length;

      exam.answers.forEach((answer: number, index: number) => {
        const question = exam.questions[index];
        
        if (!question || !question.choices) return;

        // Find the index of the correct answer
        const correctAnswerIndex = question.choices.findIndex(
          (choice: any) => choice.isCorrect === true
        );

        if (answer === -1) {
          // Unattempted
          totalUnattempted++;
        } else if (answer === correctAnswerIndex) {
          // Correct answer
          totalCorrect++;
        } else {
          // Incorrect answer
          totalIncorrect++;
        }
      });
    });

    // Calculate percentage marks
    const marks = totalQuestions > 0 
      ? parseFloat(((totalCorrect / totalQuestions) * 100).toFixed(2))
      : 0;

    // Get last exam date (use finishTime if available, otherwise updatedAt)
    const lastExamDate = exams
      .map((exam: any) => exam.finishTime || exam.updatedAt)
      .filter((date: any) => date !== null)
      .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())[0];

    return res.status(200).json({
      marks,
      totalQuestions,
      correct: totalCorrect,
      incorrect: totalIncorrect,
      unattempted: totalUnattempted,
      subject,
      userId,
      examCount: exams.length,
      lastExamDate: lastExamDate ? new Date(lastExamDate).toISOString() : null,
    });
  } catch (error: any) {
    console.error("Error fetching user subject details:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error"
    });
  }
};
