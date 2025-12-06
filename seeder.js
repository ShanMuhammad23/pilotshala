import { connectDB } from "./dist/config/database.js";
import { Question } from "./dist/models/index.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const main = async () => {
  const jsonList = fs.readFileSync("./questions.json", "utf-8");

  const questions = JSON.parse(jsonList);

  await connectDB();
  await Question.deleteMany();
  await Question.insertMany(questions);
  console.log("Data imported successfully");
  process.exit();
};

main();
