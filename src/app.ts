import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.js";
import questionRoutes from "./routes/question.js";
import examRoutes from "./routes/exam.js";
import planRoutes from "./routes/plan.js";
import webhookRoutes from "./routes/webhook.js";
import paymentRoutes from "./routes/payment.js";
import practiceRoutes from "./routes/practice.js";
import practiceWithCacheRoutes from "./routes/practice-with-cache.js";
import mediaRoutes from "./routes/media.js";
import blogRoutes from "./routes/blog.js";
import analyticsRoutes from "./routes/analytics.js";
import queryRoutes from "./routes/query.js";
import testimonialRoutes from "./routes/testimonial.js";
import emailRoutes from "./routes/email.js";
import { connectDB, checkDBConnection } from "./config/database.js";
import cron from "node-cron";
import { updateExpiredSubscriptions, cleanupAbandonedSubscriptions } from "./utils/expiry.js";
import { createPracticeCache } from "./practice-page-cache.js";
import { aggregateHourlyActiveUsers } from "./utils/hourlyTracker.js";
import { publishScheduledBlogs } from "./controllers/blog.js";
import dayjs from "dayjs";
// import { sendEmailEndpoint } from "./utils/email.js";

const app = express();

const origins = [
  "http://localhost:3000",
  "https://pilotshala.com",
  "https://www.pilotshala.com",
];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
// app.options(/^\/.*$/, cors(corsOptions));

// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   if (origin && origins.includes(origin)) {
//     res.setHeader("Access-Control-Allow-Origin", origin);
//     res.setHeader("Access-Control-Allow-Credentials", "true");
//     res.setHeader(
//       "Access-Control-Allow-Methods",
//       "GET,POST,PUT,DELETE,OPTIONS"
//     );
//     res.setHeader(
//       "Access-Control-Allow-Headers",
//       "Origin,X-Requested-With,Content-Type,Accept,Authorization"
//     );
//   }
//   next();
// });

// CRITICAL FIX: Remove duplicate webhook route - only keep the /api/webhooks route
// app.use("/webhooks", webhookRoutes);

app.use(express.json());
app.use(cookieParser());

app.get("/api/waters", (req, res, next) => {
  res.send("Hello from exam route");
});
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/practice-with-cache", practiceWithCacheRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/email", emailRoutes);

// Add a direct test route to verify routing is working
app.get("/api/email-direct-test", (req, res) => {
  res.json({ message: "Direct email test route working" });
});

app.post("/api/email-direct-test", (req, res) => {
  res.json({ message: "Direct email POST test route working", body: req.body });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbConnected = checkDBConnection();
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    database: dbConnected ? "connected" : "disconnected",
    mongodb_uri_set: !!process.env.MONGO_URI
  });
});
// app.post("/api/email", sendEmailEndpoint);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

cron.schedule("2 * * * *", () => {
  console.log("Updating expired subscriptions");
  updateExpiredSubscriptions();
  // Add your task logic here
});

cron.schedule("20 * * * *", () => {
  console.log("Creating practice cache");
  createPracticeCache();
});

// CRITICAL FIX: Clean up abandoned subscriptions every hour
cron.schedule("0 * * * *", () => {
  console.log("Cleaning up abandoned subscriptions");
  cleanupAbandonedSubscriptions();
});

cron.schedule("0 * * * *", async () => {
  const now = dayjs();
  const currentHour = now.hour();
  // Aggregate for the previous hour
  const hourToAggregate = currentHour === 0 ? 23 : currentHour - 1;
  const dateToAggregate = currentHour === 0 ? now.subtract(1, "day").format("YYYY-MM-DD") : now.format("YYYY-MM-DD");
  console.log(`[CRON] Aggregating active users for ${dateToAggregate} hour ${hourToAggregate}`);
  await aggregateHourlyActiveUsers(dateToAggregate);
});

cron.schedule("*/5 * * * *", () => {
  console.log("Publishing scheduled blogs");
  publishScheduledBlogs();
});

export default app;
