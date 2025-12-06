import mongoose from "mongoose";

let isConnected: boolean = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log("Using existing database connection");
    return;
  }

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    console.log("Attempting to connect to MongoDB...");
    console.log("MongoDB URI:", process.env.MONGO_URI!);

    const conn = await mongoose.connect(process.env.MONGO_URI+ "/main");

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      isConnected = true;
    });

    return conn;
  } catch (error: any) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error("Please check your MONGO_URI environment variable and MongoDB service.");
    throw error;
  }
};

export const checkDBConnection = () => {
  return mongoose.connection.readyState === 1;
};
