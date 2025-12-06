import { User } from "../models/index.js";

export const getExpiryDate = (plan: string) => {
  const monthlyExpiry = new Date().setMonth(new Date().getMonth() + 1);
  const quarterlyExpiry = new Date().setMonth(new Date().getMonth() + 3);
  const halfYearlyExpiry = new Date().setMonth(new Date().getMonth() + 6);
  const weeklyExpiry = new Date().setDate(new Date().getDate() + 7);

  if (plan === "monthly") return new Date(monthlyExpiry);
  if (plan === "quarterly") return new Date(quarterlyExpiry);
  if (plan === "half-yearly") return new Date(halfYearlyExpiry);
  if (plan === "weekly") return new Date(weeklyExpiry);

  return null;
};

export const calculateSubscriptionDates = (planInterval: string, startDate: Date = new Date()) => {
  const start = new Date(startDate);
  let expiry: Date;

  switch (planInterval) {
    case "weekly":
      expiry = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      expiry = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case "quarterly":
      expiry = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case "half-yearly":
      expiry = new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000);
      break;
    case "yearly":
      expiry = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      expiry = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // Default to monthly
  }

  return {
    startDate: start,
    expiryDate: expiry,
    purchaseDate: new Date() // Current time as purchase date
  };
};

export const getSubscriptionDuration = (startDate: Date, endDate: Date) => {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const updateExpiredSubscriptions = async () => {
  const users = await User.find({
    "subscription.status": "active",
    "subscription.expire": { $lt: new Date() },
    "subscription.auto_pay": false,
  });

  for (const user of users) {
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.status": "expired",
        "subscription.auto_pay": false,
        "subscription.free": false,
        "subscription.autoRenewalCount": 0,
      },
    });
  }
};

// CRITICAL FIX: Clean up abandoned subscriptions that were created but never paid
export const cleanupAbandonedSubscriptions = async () => {
  try {
    console.log("Cleaning up abandoned subscriptions...");
    
    // Find users who have subscription IDs but no active subscription status
    // This indicates they started the subscription process but payment failed
    const abandonedUsers = await User.find({
      $or: [
        { "razorpay.subscriptionId": { $exists: true, $ne: null } },
        { "stripe.subscriptionId": { $exists: true, $ne: null } }
      ],
      $and: [
        { "subscription.status": { $ne: "active" } },
        { "subscription.expire": { $exists: false } },
        { "subscription.purchaseDate": { $exists: false } }
      ]
    });
    
    if (abandonedUsers.length > 0) {
      console.log(`Found ${abandonedUsers.length} users with abandoned subscriptions`);
      
      for (const user of abandonedUsers) {
        console.log(`Cleaning up abandoned subscription for user: ${user.email}`);
        
        // Reset subscription data for abandoned subscriptions
        await User.findByIdAndUpdate(user._id, {
          $unset: {
            "subscription.plan": "",
            "subscription.gateway": "",
            "razorpay.subscriptionId": "",
            "stripe.subscriptionId": "",
          }
        });
        
        console.log(`Cleaned up abandoned subscription for user: ${user.email}`);
      }
    } else {
      console.log("No abandoned subscriptions found");
    }
  } catch (error) {
    console.error("Error cleaning up abandoned subscriptions:", error);
  }
};
