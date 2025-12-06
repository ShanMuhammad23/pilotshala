import express from "express";
import bcrypt from "bcryptjs";
import { Plan, User, Payment } from "../models/index.js";
import { verifyGoogleToken } from "../utils/google.js";
import { sendConfirmationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../utils/email.js";
import axios from "axios";
import { getToken, verifyToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME, cookieOptions } from "../utils/constants.js";
import Razorpay from "razorpay";
import { calculateSubscriptionDates, getSubscriptionDuration } from "../utils/expiry.js";
// import { deleteS3Image } from "../utils/s3.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const createConfirmCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const createUser = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    let { email, password } = req.body;
    email = email?.toLowerCase().trim();
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide an email and password" });
    }
    const existingUser = await User.findOne({
      email,
    });
    if (existingUser) {
      if (existingUser.authType === "google") {
        return res.status(400).json({ message: "Please login with Google" });
      }
      return res.status(400).json({ message: "User already exists" });
    }

    let user: any = new User({
      email,
      password: bcrypt.hashSync(password, 10),
      authType: "email",
      name: req.body.name,
    });
    user.confirmationCode = createConfirmCode();
    await user.save();
    sendConfirmationEmail(user.email, user.confirmationCode);

    const token = getToken(user._id.toString());
    // if (user.verified)
    // res.cookie("auth_cookie_verified", user.verified, cookieOptions);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    user = await User.findById(user._id);
    return res.status(201).json({ user, token });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const loginWithEmail = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    let { email, password } = req.body;
    email = email?.toLowerCase().trim();
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide an email and password" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exists" });
    }
    if (user.authType === "google") {
      return res.status(400).json({ message: "Please login with Google" });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" });
    }
    if (!user.verified) {
      user.confirmationCode = createConfirmCode();
      await user.save();
      sendConfirmationEmail(user.email, user.confirmationCode);
    }

    const token = getToken(user._id.toString());
    // if (user.verified)
    //   res.cookie("auth_cookie_verified", user.verified, cookieOptions);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    return res.status(200).json({ user, token });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const loginWithGoogle = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    if (!req.body.token) {
      return res.status(400).json({ message: "Please provide a token" });
    }
    const decoded = await verifyGoogleToken(req.body.token);

    if (!decoded?.email) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const existing = await User.findOne({ email: decoded.email });
    if (existing) {
      // if (existing.authType !== "google") {
      //   return res
      //     .status(400)
      //     .json({ message: "Please login with email and password" });
      // }
      const token = getToken(existing._id.toString());
      // if (existing.verified)
      //   res.cookie("auth_cookie_verified", existing.verified, cookieOptions);
      res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
      return res.status(200).json({ user: existing, token });
    }

    let user: any = new User({
      email: decoded.email,
      authType: "google",
      name: decoded.name,
      verified: true,
      profilePicture: decoded.picture,
      password: "N/A",
    });

    const token = getToken(user._id.toString());
    await user.save();

    // if (user.verified)
    //   res.cookie("auth_cookie_verified", user.verified, cookieOptions);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    user = await User.findById(user._id);
    return res.status(200).json({ user, token });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const sendConfirmationCode = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user?.verified) {
      return res.status(404).json({ message: "You are already verified" });
    }

    const code = createConfirmCode();
    user.confirmationCode = code;
    sendConfirmationEmail(user.email, code);
    await user.save();

    return res.json({ message: "Confirmation Code Sent Successfully" });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const confirmEmail = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    if (!req.body.code) {
      return res.status(400).json({ message: "Please provide a code" });
    }

    const user = req.user;
    if (user.confirmationCode !== req.body.code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    user.verified = true;
    user.confirmationCode = "";
    await user.save();

    const token = getToken(user._id.toString());

    // if (user.verified)
    //   res.cookie("auth_cookie_verified", user.verified, cookieOptions);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    return res.status(200).json({ user, token });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const getUserDetails = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    return res.status(200).json(user);
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const testWhatsApp = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { data } = await axios.post(
      `https://graph.facebook.com/v21.0/372199672644488/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "923181540645",
        type: "text",
        text: {
          preview_url: true,
          body: "As requested, here'''s the link to our latest product: https://www.meta.com/quest/quest-3/",
        },
      },
      {
        headers: {
          Authorization:
            "Bearer EAALbVg0y81ABOxk6R7Da8EXoS4KqhuHZCdnIs7jzml46k9eZCABRlzqASuZAB0ysq9aiW93Vx2nZCyAMy95l46y0lMu72HEfyFCZAMrpc2UXHVckS4tFE8OlvmZBJtMcBau6yWDmFZCnZBQRRzWSuBLtSDgXySZChBLREGxFDxXHHgPZBc0j7pgIb0aRZAnU2rZCwoS69yHKpQxZBxH3FPtRLpJWJX1XDCUFDjDP6uZCCCW78VZBEQZD",
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

// Add Profile Picture
// @Private
// POST /api/users/image
export const updateImage = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = await User.findById(req.user._id);

    const newImage = req.fileUrls![0];
    const prevImage = user?.profilePicture;

    // deleteS3Image(prevImage!);

    if (user && newImage) {
      user.profilePicture = newImage;
      await user?.save();
    }

    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

// Update User Details
// @Private
// PUT /api/users
export const updateUser = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;
    const name = req.body?.name?.trim();
    const phone = req.body?.phone?.trim();
    const newPassword = req.body?.newPassword?.trim();
    const oldPassword = req.body?.oldPassword?.trim();

    if (newPassword) {
      const isPasswordValid = bcrypt.compareSync(oldPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Old password is incorrect" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters long",
        });
      }
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          name,
          phone,
          password: newPassword
            ? bcrypt.hashSync(newPassword, 10)
            : user.password,
        },
      },
      {
        new: true,
      }
    );

    return res.status(200).json({ success: true, user: updated });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

// Update User Details
// @Private
// PUT /api/users/admin
export const getAllUsers = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const users = await User.find({})
      .select("-password")
      .populate("subscription.plan");
    return res.status(200).json({ users });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const logout = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
    res.json({ success: true });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const getCookie = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(decoded.id);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.json({ success: true, user, token });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const hideWalkthrough = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;
    user.showWalkthrough = false;
    await user.save();
    return res.status(200).json({ success: true, user });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const changeUserPlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { planId, userId, manualAmount } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!planId) return res.status(400).json({ error: "Plan ID is required" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Calculate subscription dates using utility function
    const { startDate, expiryDate, purchaseDate } = calculateSubscriptionDates(plan.interval);

    // Update user's subscription plan
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.plan": plan._id,
        "subscription.status": "active",
        "subscription.gateway": "admin",
        "subscription.free": false,
        "subscription.auto_pay": false,
        "subscription.purchaseDate": purchaseDate,
        "subscription.startDate": startDate,
        "subscription.expire": expiryDate,
      },
    });

    // Create payment record if manual amount is provided
    if (manualAmount && manualAmount > 0) {
      try {
        const payment = new Payment({
          amount: manualAmount,
          currency: "INR", // Default currency
          paymentMethod: "manual",
          paymentStatus: "completed",
          paymentGateway: "admin",
          paymentId: `MANUAL_${Date.now()}_${user._id}`,
          user: user._id,
          plan: plan._id,
          purchaseDate: purchaseDate,
          expireAt: expiryDate,
        });
        await payment.save();
        console.log(`Manual payment record created for user ${user.email}: ${manualAmount} INR`);
      } catch (paymentError: any) {
        console.error("Failed to create manual payment record:", paymentError);
        // Don't fail the plan change if payment record creation fails
      }
    }

    // Send welcome email for plan activation
    try {
      await sendWelcomeEmail(user.email, user.name || "User");
      console.log(`Welcome email sent to ${user.email} for admin plan activation`);
    } catch (error) {
      console.error("Failed to send welcome email for admin plan activation:", error);
    }

    return res.json({ 
      message: "Plan updated successfully",
      manualPaymentRecorded: manualAmount && manualAmount > 0
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const addFreeAccess = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId, days, planId } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    // If planId is provided, validate it exists
    let plan = null;
    if (planId) {
      plan = await Plan.findById(planId);
      if (!plan) return res.status(404).json({ error: "Plan not found" });
    }

    // Calculate dates for free access
    const purchaseDate = new Date();
    const startDate = new Date();
    const expiryDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Update user's subscription plan
    const updateData: any = {
      "subscription.free": false,
      "subscription.status": "active",
      "subscription.gateway": "admin",
      "subscription.auto_pay": false,
      "subscription.purchaseDate": purchaseDate,
      "subscription.startDate": startDate,
      "subscription.expire": expiryDate,
    };

    // Set plan if provided
    if (plan) {
      updateData["subscription.plan"] = plan._id;
    }

    await User.findByIdAndUpdate(user._id, {
      $set: updateData,
    });

    // Send welcome email for free access activation
    try {
      await sendWelcomeEmail(user.email, user.name || "User");
      console.log(`Welcome email sent to ${user.email} for free access activation`);
    } catch (error) {
      console.error("Failed to send welcome email for free access activation:", error);
    }

    return res.json({ 
      message: "Plan updated successfully",
      planAssigned: !!plan
    });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const extendUserPlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId, days } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    const existingExpiry = user.subscription?.expire;
    if (!existingExpiry)
      return res.status(400).json({ error: "No existing subscription found" });

    const expiry = new Date(existingExpiry).setDate(
      new Date(existingExpiry).getDate() + days
    );

    // Update user's subscription plan
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.expire": expiry,
      },
    });

    return res.json({ message: "Plan updated successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const suspendUserPlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId } = req.query;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user?.subscription?.free && user?.subscription?.status === "active") {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "subscription.status": "inactive",
          "subscription.expire": null,
          "subscription.plan": null,
          "subscription.auto_pay": false,
          "subscription.gateway": null,
          "subscription.free": true,
        },
      });
      return res.json({ message: "User plan suspended successfully" });
    }
    if (!user.subscription?.plan)
      return res.status(400).json({ error: "User does not have a plan" });
    if (user.subscription.status === "inactive")
      return res.status(400).json({ error: "User plan is already suspended" });
    // Suspend the user's plan

    try {
      await razorpay.subscriptions.cancel(user.razorpay?.subscriptionId || "");
    } catch (error: any) {
      console.log("Error cancelling subscription:", error);
    }

    await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.status": null,
        "subscription.expire": null,
        "subscription.plan": null,
        "subscription.auto_pay": false,
        "subscription.gateway": null,
        "subscription.free": true,
      },
    });
    return res.json({ message: "User plan suspended successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const addUser = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = new User({
      email,
      name,
      password: hashedPassword,
      authType: "email",
      verified: true,
    });
    await user.save();
    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user?.subscription?.status === "active" &&
      user?.razorpay?.subscriptionId
    ) {
      try {
        await razorpay.subscriptions.cancel(user.razorpay.subscriptionId);
      } catch (error: any) {
        console.log("Error cancelling subscription:", error);
      }
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const editUser = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;

    const body = req.body;

    if (body.password) {
      body.password = bcrypt.hashSync(body.password, 10);
    }

    const user = await User.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User updated successfully" });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const getSubscriptionDetails = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;
    
    if (!user.subscription?.plan) {
      return res.json({
        hasSubscription: false,
        message: "No active subscription found"
      });
    }

    const plan = await Plan.findById(user.subscription.plan);
    const autoRenewalCount = user.subscription?.autoRenewalCount || 0;
    const canAutoRenew = autoRenewalCount < 1;
    const needsManualRenewal = autoRenewalCount >= 1;

    // Calculate subscription duration if dates are available
    let duration = null;
    if (user.subscription.startDate && user.subscription.expire) {
      const startDate = new Date(user.subscription.startDate);
      const endDate = new Date(user.subscription.expire);
      duration = getSubscriptionDuration(startDate, endDate);
    }

    return res.json({
      hasSubscription: true,
      subscription: {
        status: user.subscription.status,
        plan: plan,
        purchaseDate: user.subscription.purchaseDate,
        startDate: user.subscription.startDate,
        expire: user.subscription.expire,
        auto_pay: user.subscription.auto_pay,
        autoRenewalCount: autoRenewalCount,
        canAutoRenew: canAutoRenew,
        needsManualRenewal: needsManualRenewal,
        gateway: user.subscription.gateway,
        free: user.subscription.free,
        duration: duration // Duration in days
      },
      message: needsManualRenewal 
        ? "Auto-renewal limit reached. Manual renewal required for next billing cycle."
        : "Subscription is active with auto-renewal enabled."
    });
  } catch (error: any) {
    console.error("Error in getSubscriptionDetails:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const getUsersByExpiryDate = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { daysFromNow, includeExpired } = req.query;
    
    // Build query based on filters
    let query: any = {
      "subscription.expire": { $exists: true, $ne: null }
    };

    // If daysFromNow is provided, filter users expiring within that many days
    if (daysFromNow) {
      const days = parseInt(daysFromNow as string);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      query["subscription.expire"] = {
        $gte: new Date(),
        $lte: targetDate
      };
    }

    // If includeExpired is false, only show active subscriptions
    if (includeExpired !== 'true') {
      query["subscription.status"] = "active";
    }

    // Get users based on query
    const users = await User.find(query)
      .select("name email subscription.expire subscription.plan subscription.status")
      .populate("subscription.plan");

    // Group users by expiry date
    const groupedUsers: { [key: string]: any[] } = {};
    
    users.forEach(user => {
      if (user.subscription?.expire) {
        const expiryDate = new Date(user.subscription.expire);
        const dateKey = expiryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!groupedUsers[dateKey]) {
          groupedUsers[dateKey] = [];
        }
        
        groupedUsers[dateKey].push({
          _id: user._id,
          name: user.name,
          email: user.email,
          expiryDate: user.subscription.expire,
          plan: user.subscription.plan,
          status: user.subscription.status,
          daysUntilExpiry: Math.ceil((new Date(user.subscription.expire).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        });
      }
    });

    // Convert to array format and sort by date
    const result = Object.entries(groupedUsers)
      .map(([date, users]) => ({
        expiryDate: date,
        userCount: users.length,
        users: users.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry) // Sort users by days until expiry
      }))
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    return res.status(200).json({ 
      success: true,
      data: result,
      totalGroups: result.length,
      totalUsers: users.length,
      filters: {
        daysFromNow: daysFromNow || null,
        includeExpired: includeExpired === 'true'
      }
    });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

// Grant Manager Access
// @Private
// POST /api/users/admin/grant-manager-access
export const grantManagerAccess = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user to have manager access
    await User.findByIdAndUpdate(userId, {
      isManager: true,
      isTeam: false // Remove team access if granting manager access
    });

    return res.status(200).json({ 
      success: true, 
      message: "Manager access granted successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isManager: true,
        isTeam: false
      }
    });
  } catch (error: any) {
    console.error("Error granting manager access:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Grant Team Access
// @Private
// POST /api/users/admin/grant-team-access
export const grantTeamAccess = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User ID is required" });
    }

    // Update user to have team access
    await User.findByIdAndUpdate(userId, {
      isTeam: true,
      isManager: false // Remove manager access if granting team access
    });

    return res.status(200).json({ 
      success: true, 
      message: "Team access granted successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isManager: false,
        isTeam: true
      }
    });
  } catch (error: any) {
    console.error("Error granting team access:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Revoke Manager Access
// @Private
// POST /api/users/admin/revoke-manager-access
export const revokeManagerAccess = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user to remove manager access
    await User.findByIdAndUpdate(userId, {
      isManager: false
    });

    return res.status(200).json({ 
      success: true, 
      message: "Manager access revoked successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isManager: false,
        isTeam: user.isTeam
      }
    });
  } catch (error: any) {
    console.error("Error revoking manager access:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Revoke Team Access
// @Private
// POST /api/users/admin/revoke-team-access
export const revokeTeamAccess = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user to remove team access
    await User.findByIdAndUpdate(userId, {
      isTeam: false
    });

    return res.status(200).json({ 
      success: true, 
      message: "Team access revoked successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isManager: user.isManager,
        isTeam: false
      }
    });
  } catch (error: any) {
    console.error("Error revoking team access:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Password Reset Functions
export const sendPasswordResetOtp = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.authType === "google") {
      return res.status(400).json({
        success: false,
        message: "Password reset is not available for Google accounts",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set OTP expiry to 10 minutes from now
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP and expiry to user
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    await sendPasswordResetEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent successfully",
    });
  } catch (error: any) {
    console.error("Send password reset OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset OTP",
      error: error.message,
    });
  }
};

export const verifyPasswordResetOtp = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.passwordResetOtp || !user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: "No password reset OTP found",
      });
    }

    if (user.passwordResetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error: any) {
    console.error("Verify password reset OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

export const resetPassword = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.passwordResetOtp || !user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: "No password reset OTP found",
      });
    }

    if (user.passwordResetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    
    // Update password and clear OTP fields
    user.password = hashedPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    });
  }
};
