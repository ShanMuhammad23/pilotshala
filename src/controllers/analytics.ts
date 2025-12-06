import express from "express";
import { Exam, User } from "../models/index.js";
import { AUTH_COOKIE_NAME } from "../utils/constants.js";
import { verifyToken } from "../utils/jwt.js";
import {
  recordUserActivity,
  getHourlyStats,
  getMultiDayHourlyStats,
  getCurrentHourStats,
  initializeHourlyTracking,
  getActualHourlyActiveUsers,
  aggregateHourlyActiveUsers
} from "../utils/hourlyTracker.js";
import Razorpay from "razorpay";
import dayjs from "dayjs";

// Initialize hourly tracking on module load
initializeHourlyTracking();

// Track current active user count globally
let currentActiveUsers: number | null = null;

function getSimulatedActiveUsers(): number {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5.5) % 24;

  const isPeakHours = (istHour >= 18) || (istHour < 1);
  const minUsers = isPeakHours ? 600 : 300;
  const maxUsers = isPeakHours ? 1100 : 700;

  // Initialize to middle of range if first call
  if (currentActiveUsers === null) {
    currentActiveUsers = Math.floor((minUsers + maxUsers) / 2);
    return currentActiveUsers;
  }

  // Fluctuate by ±0-50 per interval
  const direction = Math.random() < 0.5 ? -1 : 1;
  const change = Math.floor(Math.random() * 51) * direction;

  let newValue = currentActiveUsers + change;

  // Clamp within allowed range
  newValue = Math.max(minUsers, Math.min(maxUsers, newValue));

  currentActiveUsers = newValue;

  return currentActiveUsers;
}

// Endpoint: Live Stats API
export const getLiveStats = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const simulatedActiveUsers = getSimulatedActiveUsers();

    // Total Exam Attempts (No date filter for now)
    const examCount = await Exam.countDocuments({});

    // Real current hour stats
    const currentHourStats = await getCurrentHourStats();

    // Generate dummy "last 24 hours" attempts (optional simulation)
    const last24Hours = Math.floor(Math.random() * 101) + 250;

    const liveStats = {
      last24Hours,
      examCount,
      currentUsers: simulatedActiveUsers,
      currentHour: {
        hour: currentHourStats.hour,
        activeUsers: simulatedActiveUsers,
        uniqueUsers: currentHourStats.uniqueUsers,
      },
    };

    return res.status(200).json(liveStats);
  } catch (error) {
    console.error("Error fetching live stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Heartbeat (User Ping)
export const heartbeat = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const token =
      req.cookies[AUTH_COOKIE_NAME] || req.headers.authorization?.split(" ")[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user) {
        await User.findByIdAndUpdate(
          decoded.id,
          { lastActive: new Date() },
          { new: true }
        );
        // Record for hourly tracking
        recordUserActivity(decoded.id);
      }
    }

    return res.status(200).json({ message: "Heartbeat recorded" });
  } catch (error) {
    console.error("Error recording heartbeat:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Admin Summary Stats
export const getAdminStats = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const totalUsers = await User.countDocuments({});
    const exams = await Exam.countDocuments({});
    const subscribedUsers = await User.countDocuments({ "subscription.status": "active" });
    
    var instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // Fetch all payments using pagination
    let allPayments: any[] = [];
    let skip = 0;
    const count = 100; // Razorpay's limit per request
    let hasMore = true;

    while (hasMore) {
      try {
        const paymentsResponse = await instance.payments.all({
          count: count,
          skip: skip,
        });

        if (paymentsResponse.items && paymentsResponse.items.length > 0) {
          allPayments = allPayments.concat(paymentsResponse.items);
          
          // Check if there are more payments to fetch
          if (paymentsResponse.items.length < count) {
            hasMore = false;
          } else {
            skip += count;
          }
        } else {
          hasMore = false;
        }
      } catch (razorpayError) {
        console.error("Error fetching payments from Razorpay:", razorpayError);
        hasMore = false;
      }
    }

    // Calculate payment statistics
    const totalPayments = allPayments.length;
    const successfulPayments = allPayments.filter(payment => payment.status === 'captured');
    const totalRevenue = successfulPayments.reduce((sum, payment) => {
      return sum + (payment.amount || 0);
    }, 0);

    return res.json({
      totalUsers,
      exams,
      questions: "12000+",
      subscribedUsers,
      payments: {
        totalPayments,
        successfulPayments: successfulPayments.length,
        totalRevenue: totalRevenue / 100, // Convert from paise to rupees
        allPayments: allPayments
      }
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Hourly Stats for a Date
export const getHourlyAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().slice(0, 10);

    const hourlyStats = await getHourlyStats(targetDate);

    const totalActiveUsers = hourlyStats.reduce((sum, hour) => sum + hour.activeUsers, 0);
    const maxActiveUsers = Math.max(...hourlyStats.map(hour => hour.activeUsers));
    const avgActiveUsers = totalActiveUsers / 24;

    return res.status(200).json({
      date: targetDate,
      hourlyData: hourlyStats,
      summary: {
        totalActiveUsers,
        maxActiveUsers,
        avgActiveUsers: Math.round(avgActiveUsers * 100) / 100,
        peakHour: hourlyStats.find(hour => hour.activeUsers === maxActiveUsers)?.hour || 0,
      }
    });
  } catch (error) {
    console.error("Error fetching hourly analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Multi-Day Hourly Stats
export const getMultiDayHourlyAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const hourlyStats = await getMultiDayHourlyStats(startDate as string, endDate as string);

    const summary = Object.keys(hourlyStats).map(date => {
      const dayData = hourlyStats[date];
      const totalActiveUsers = dayData.reduce((sum, hour) => sum + hour.activeUsers, 0);
      const maxActiveUsers = Math.max(...dayData.map(hour => hour.activeUsers));
      const avgActiveUsers = totalActiveUsers / 24;

      return {
        date,
        totalActiveUsers,
        maxActiveUsers,
        avgActiveUsers: Math.round(avgActiveUsers * 100) / 100,
        peakHour: dayData.find(hour => hour.activeUsers === maxActiveUsers)?.hour || 0,
      };
    });

    return res.status(200).json({
      startDate,
      endDate,
      hourlyData: hourlyStats,
      summary,
    });
  } catch (error) {
    console.error("Error fetching multi-day hourly analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Current Hour Analytics
export const getCurrentHourAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const currentStats = await getCurrentHourStats();

    return res.status(200).json({
      currentHour: currentStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching current hour analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Actual Hourly Active Users for Date
export const getActualHourlyActiveUsersAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().slice(0, 10);
    const data = await getActualHourlyActiveUsers(targetDate);

    return res.status(200).json({ date: targetDate, hourlyActiveUsers: data });
  } catch (error) {
    console.error("Error fetching actual hourly active users analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Endpoint: Recalculate Hourly Active Users for Date
export const recalculateHourlyActiveUsersAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().slice(0, 10);
    await aggregateHourlyActiveUsers(targetDate);
    const data = await getActualHourlyActiveUsers(targetDate);

    return res.status(200).json({ date: targetDate, hourlyActiveUsers: data });
  } catch (error) {
    console.error("Error recalculating hourly active users analytics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to get week start (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// Helper function to get week end (Sunday)
const getWeekEnd = (date: Date): Date => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

// Helper function to get month start
const getMonthStart = (date: Date): Date => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
};

// Helper function to get month end
const getMonthEnd = (date: Date): Date => {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return monthEnd;
};

// Get hourly active users for a specific day
const getHourlyActiveUsers = async (date: Date): Promise<any[]> => {
  const timeData = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const hourStart = dayjs(date).hour(hour).minute(0).second(0).millisecond(0).toDate();
    const hourEnd = dayjs(date).hour(hour).minute(59).second(59).millisecond(999).toDate();
    
    // Count distinct users whose lastActive is within this hour
    const activeUserCount = await User.countDocuments({
      lastActive: { $gte: hourStart, $lte: hourEnd }
    });
    
    timeData.push({
      hour,
      totalUsers: activeUserCount,
      activeUsers: activeUserCount,
      uniqueUsers: activeUserCount,
      lastUpdated: hourEnd.toISOString()
    });
  }
  
  return timeData;
};

// Get daily active users for a date range
const getDailyActiveUsers = async (startDate: Date, endDate: Date): Promise<any[]> => {
  const timeData = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Count distinct users whose lastActive is within this day
    const activeUserCount = await User.countDocuments({
      lastActive: { $gte: dayStart, $lte: dayEnd }
    });
    
    timeData.push({
      day: currentDate.getDate(),
      date: currentDate.toISOString().split('T')[0],
      totalUsers: activeUserCount,
      activeUsers: activeUserCount,
      uniqueUsers: activeUserCount,
      lastUpdated: dayEnd.toISOString()
    });
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return timeData;
};

// Calculate summary statistics
const calculateSummary = (timeData: any[], period: string): any => {
  if (timeData.length === 0) {
    return {
      totalActiveUsers: 0,
      maxActiveUsers: 0,
      avgActiveUsers: 0,
      ...(period === 'daily' ? { peakHour: 0 } : { peakDay: 1, peakDate: null })
    };
  }
  
  const totalActiveUsers = timeData.reduce((sum, item) => sum + item.totalUsers, 0);
  const maxActiveUsers = Math.max(...timeData.map(item => item.totalUsers), 0);
  const avgActiveUsers = timeData.length > 0 ? totalActiveUsers / timeData.length : 0;
  
  const summary: any = {
    totalActiveUsers,
    maxActiveUsers,
    avgActiveUsers: Math.round(avgActiveUsers * 100) / 100
  };
  
  if (period === 'daily') {
    const peakItem = timeData.reduce((max, item) => 
      item.totalUsers > max.totalUsers ? item : max
    );
    summary.peakHour = peakItem.hour;
  } else {
    const peakItem = timeData.reduce((max, item) => 
      item.totalUsers > max.totalUsers ? item : max
    );
    summary.peakDay = peakItem.day;
    summary.peakDate = peakItem.date;
  }
  
  return summary;
};

// Endpoint: Multi-Period Active Users Analytics
export const getActiveUsersAnalytics = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { period, date } = req.query;
    
    // Validation
    if (!period || !date) {
      return res.status(400).json({ 
        error: 'period and date are required' 
      });
    }
    
    if (!['daily', 'weekly', 'monthly'].includes(period as string)) {
      return res.status(400).json({ 
        error: 'period must be one of: daily, weekly, monthly' 
      });
    }
    
    // Parse and validate date
    const selectedDate = dayjs(date as string);
    if (!selectedDate.isValid()) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }
    
    const dateObj = selectedDate.toDate();
    let startDate: Date;
    let endDate: Date | undefined;
    let timeData: any[];
    
    // Calculate date range based on period
    if (period === 'daily') {
      startDate = dayjs(dateObj).startOf('day').toDate();
      endDate = dayjs(dateObj).endOf('day').toDate();
      timeData = await getHourlyActiveUsers(dateObj);
    } else if (period === 'weekly') {
      startDate = getWeekStart(dateObj);
      endDate = getWeekEnd(dateObj);
      timeData = await getDailyActiveUsers(startDate, endDate);
    } else { // monthly
      startDate = getMonthStart(dateObj);
      endDate = getMonthEnd(dateObj);
      timeData = await getDailyActiveUsers(startDate, endDate);
    }
    
    // Calculate summary
    const summary = calculateSummary(timeData, period as string);
    
    // Build response
    const response: any = {
      period,
      startDate: dayjs(startDate).format('YYYY-MM-DD'),
      timeData,
      summary
    };
    
    // Add endDate for weekly and monthly periods
    if (period !== 'daily' && endDate) {
      response.endDate = dayjs(endDate).format('YYYY-MM-DD');
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching active users analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
