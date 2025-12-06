import app from "./app.js";
import dotenv from "dotenv";
import { connectDB } from "./config/database.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || '4321');

// Start server with optional database connection
const startServer = async () => {
  try {
    console.log("Initializing server...");
    
    // Try to connect to database but don't fail if it doesn't work
    try {
      const connectionPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database connection timeout after 15 seconds")), 15000);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      console.log("Database connection established successfully");
    } catch (dbError: any) {
      console.warn("Database connection failed, starting server without DB:", dbError.message);
      console.warn("Some features may not work properly");
    }
    
    // Start the server regardless of database connection
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
