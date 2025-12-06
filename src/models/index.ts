import mongoose from "mongoose";
import { userSchema } from "./user.js";
import { questionSchema } from "./question.js";
import { examSchema } from "./exam.js";
import { planSchema } from "./plan.js";
import { paymentSchema } from "./payment.js";
import { mediaSchema } from "./media.js";
import { querySchema } from "./query.js";
import { blogCategorySchema, blogSchema } from "./blog.js";
import { testimonialSchema } from "./testimonial.js";
import hourlyActivitySchema from "./hourlyActivity.js";
import { topicCompletionSchema } from "./topicCompletion.js";

questionSchema.index({ question: "text" });
userSchema.index({ name: 1, email: 1 });

const User = mongoose.model("User", userSchema);

questionSchema.index({ subject: 1, book: 1, topic: 1 });
const Question = mongoose.model("Question", questionSchema);
const Exam = mongoose.model("Exam", examSchema);
const Plan = mongoose.model("Plan", planSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const Media = mongoose.model("Media", mediaSchema);
const Blog = mongoose.model("Blog", blogSchema);
const BlogCategory = mongoose.model("BlogCategory", blogCategorySchema);
const Query = mongoose.model("Query", querySchema);
const Testimonial = mongoose.model("Testimonial", testimonialSchema);
const HourlyActivity = mongoose.model("HourlyActivity", hourlyActivitySchema);
const TopicCompletion = mongoose.model("TopicCompletion", topicCompletionSchema);

export {
  User,
  Question,
  Exam,
  Plan,
  Payment,
  Media,
  Blog,
  BlogCategory,
  Query,
  Testimonial,
  HourlyActivity,
  TopicCompletion,
};
