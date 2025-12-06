import { HourlyActivity, User } from "../models/index.js";
import dayjs from "dayjs";

// Track active users in memory for current hour
let currentHourActiveUsers = new Set<string>();
let currentHourData = {
  date: new Date().toISOString().slice(0, 10),
  hour: new Date().getHours(),
};

// Reset tracking every hour
setInterval(() => {
  const now = new Date();
  const newDate = now.toISOString().slice(0, 10);
  const newHour = now.getHours();
  
  // If hour changed, save current data and reset
  if (newDate !== currentHourData.date || newHour !== currentHourData.hour) {
    saveHourlyData();
    currentHourData = { date: newDate, hour: newHour };
    currentHourActiveUsers.clear();
  }
}, 60000); // Check every minute

// Calculate active users based on lastActive field
async function calculateActiveUsers(): Promise<number> {
  try {
    // Consider users active if they were active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: fiveMinutesAgo }
    });
    return activeUsers;
  } catch (error) {
    console.error("Error calculating active users:", error);
    return 0;
  }
}

// Save current hour data to database
async function saveHourlyData() {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await calculateActiveUsers();
    // Save the set of unique user IDs for this hour
    await HourlyActivity.findOneAndUpdate(
      { date: currentHourData.date, hour: currentHourData.hour },
      {
        totalUsers,
        activeUsers,
        uniqueUsers: activeUsers,
        activeUserIds: Array.from(currentHourActiveUsers),
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );
    console.log(`Hourly data saved for ${currentHourData.date} ${currentHourData.hour}:00 - Active: ${activeUsers}, Total: ${totalUsers}`);
  } catch (error) {
    console.error("Error saving hourly data:", error);
  }
}

// Record user activity
export const recordUserActivity = (userId: string) => {
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();
  // Update current hour data if needed
  if (currentDate !== currentHourData.date || currentHour !== currentHourData.hour) {
    saveHourlyData();
    currentHourData = { date: currentDate, hour: currentHour };
    currentHourActiveUsers.clear();
  }
  // Add user to active set
  currentHourActiveUsers.add(userId);
};

// Get hourly statistics for a specific date
export const getHourlyStats = async (date: string) => {
  try {
    const hourlyData = await HourlyActivity.find({ date })
      .sort({ hour: 1 })
      .lean();
    
    // Fill in missing hours with zero data
    const completeData = [];
    for (let hour = 0; hour < 24; hour++) {
      const existingData = hourlyData.find(data => data.hour === hour);
      completeData.push({
        hour,
        totalUsers: existingData?.totalUsers || 0,
        activeUsers: existingData?.activeUsers || 0,
        uniqueUsers: existingData?.uniqueUsers || 0,
        lastUpdated: existingData?.lastUpdated || null,
      });
    }
    
    return completeData;
  } catch (error) {
    console.error("Error fetching hourly stats:", error);
    throw error;
  }
};

// Get hourly statistics for multiple dates
export const getMultiDayHourlyStats = async (startDate: string, endDate: string) => {
  try {
    const hourlyData = await HourlyActivity.find({
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: 1, hour: 1 })
      .lean();
    
    // Group by date
    const groupedData: { [date: string]: any[] } = {};
    
    hourlyData.forEach(data => {
      if (!groupedData[data.date]) {
        groupedData[data.date] = [];
      }
      groupedData[data.date].push({
        hour: data.hour,
        totalUsers: data.totalUsers,
        activeUsers: data.activeUsers,
        uniqueUsers: data.uniqueUsers,
        lastUpdated: data.lastUpdated,
      });
    });
    
    // Fill missing hours for each date
    Object.keys(groupedData).forEach(date => {
      const completeData = [];
      for (let hour = 0; hour < 24; hour++) {
        const existingData = groupedData[date].find(data => data.hour === hour);
        completeData.push({
          hour,
          totalUsers: existingData?.totalUsers || 0,
          activeUsers: existingData?.activeUsers || 0,
          uniqueUsers: existingData?.uniqueUsers || 0,
          lastUpdated: existingData?.lastUpdated || null,
        });
      }
      groupedData[date] = completeData;
    });
    
    return groupedData;
  } catch (error) {
    console.error("Error fetching multi-day hourly stats:", error);
    throw error;
  }
};

// Get current hour statistics
export const getCurrentHourStats = async () => {
  try {
    const activeUsers = await calculateActiveUsers();
    return {
      date: currentHourData.date,
      hour: currentHourData.hour,
      activeUsers,
      uniqueUsers: activeUsers,
    };
  } catch (error) {
    console.error("Error getting current hour stats:", error);
    return {
      date: currentHourData.date,
      hour: currentHourData.hour,
      activeUsers: 0,
      uniqueUsers: 0,
    };
  }
};

// New: Get actual active users per hour for a date
export const getActualHourlyActiveUsers = async (date: string) => {
  try {
    const hourlyData = await HourlyActivity.find({ date }).sort({ hour: 1 }).lean();
    const result = [];
    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyData.find(d => d.hour === hour);
      result.push({
        hour,
        activeUserCount: data?.activeUsers || 0, // Use activeUsers field
      });
    }
    return result;
  } catch (error) {
    console.error("Error fetching actual hourly active users:", error);
    throw error;
  }
};

// Aggregate and save per-hour active users for a given date
export const aggregateHourlyActiveUsers = async (date: string) => {
  for (let hour = 0; hour < 24; hour++) {
    const start = dayjs(date).hour(hour).minute(0).second(0).millisecond(0).toDate();
    const end = dayjs(date).hour(hour).minute(59).second(59).millisecond(999).toDate();
    // Count users whose lastActive is within this hour
    const activeUserCount = await User.countDocuments({
      lastActive: { $gte: start, $lte: end }
    });
    // Save or update in HourlyActivity collection
    await HourlyActivity.findOneAndUpdate(
      { date, hour },
      { activeUsers: activeUserCount },
      { upsert: true }
    );
  }
};

// Initialize tracking on startup
export const initializeHourlyTracking = async () => {
  try {
    const now = new Date();
    currentHourData = {
      date: now.toISOString().slice(0, 10),
      hour: now.getHours(),
    };
    
    // Load existing active users for current hour (users active in last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentActiveUsers = await User.find({
      lastActive: { $gte: fiveMinutesAgo }
    }).select('_id');
    
    currentHourActiveUsers = new Set(recentActiveUsers.map(user => user._id.toString()));
    
    console.log(`Hourly tracking initialized for ${currentHourData.date} ${currentHourData.hour}:00 with ${currentHourActiveUsers.size} active users`);
  } catch (error) {
    console.error("Error initializing hourly tracking:", error);
  }
}; 