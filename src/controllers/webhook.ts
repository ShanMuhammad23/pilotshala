import express from "express";
import { Payment, Plan, User } from "../models/index.js";
import Razorpay from "razorpay";
import { calculateSubscriptionDates } from "../utils/expiry.js";
import { sendWelcomeEmail } from "../utils/email.js";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

function verifyWebhookSignature(body: string, signature: any, secret: any) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

export const razorpayWebhook2 = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Event:", req.body.event);
    console.log("=========================");

    if (req.body.razorpay_payment_id && req.body.razorpay_subscription_id) {
      console.log("Processing custom webhook format...");
      return await handleCustomWebhook(req, res);
    }

    // Verify webhook signature
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    console.log("Webhook secret configured:", !!webhookSecret);
    console.log("Signature received:", !!razorpaySignature);

    let isValid = false;
    if (!webhookSecret) {
      console.warn("⚠️  WARNING: No webhook secret configured - skipping signature verification for testing");
      isValid = true;
    } else {
      isValid = verifyWebhookSignature(
        JSON.stringify(req.body),
        razorpaySignature,
        webhookSecret
      );
    }

    if (!isValid) {
      console.error("Webhook signature verification failed!");
      console.error("Expected secret:", webhookSecret);
      console.error("Received signature:", razorpaySignature);
      return res.status(400).json({ error: "Invalid signature" });
    }

    console.log("Webhook signature verified successfully");

    const event = req.body.event;
    console.log("Event type:", event);

    // Handle payment.captured event
    if (event === "payment.captured") {
      return await handlePaymentCaptured(req, res);
    }

    // Handle payment.failed event
    if (event === "payment.failed") {
      return await handlePaymentFailed(req, res);
    }

    // Handle order.paid event (for one-time payments)
    if (event === "order.paid") {
      return await handleOrderPaid(req, res);
    }

    // Handle subscription events
    if (event === "subscription.cancelled") {
      return await handleSubscriptionCancelled(req, res);
    }

    if (event === "subscription.paused") {
      return await handleSubscriptionPaused(req, res);
    }

    if (event === "subscription.resumed") {
      return await handleSubscriptionResumed(req, res);
    }

    if (event === "subscription.updated") {
      return await handleSubscriptionUpdated(req, res);
    }

    if (event === "subscription.activated") {
      console.log("Subscription activated event received - no action needed until payment is captured");
      return res.json({ message: "Subscription activated event received" });
    }

    console.log("Unhandled event type:", event);
    return res.json({ message: "Webhook received but event not handled" });

  } catch (error: any) {
    console.error("Error in webhook processing:", error);
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

async function handlePaymentCaptured(req: express.Request, res: express.Response) {
  try {
    const payment = req.body.payload.payment.entity;
    console.log("🔥 PAYMENT.CAPTURED EVENT RECEIVED 🔥");
    console.log("Payment ID:", payment.id);
    console.log("Payment Status:", payment.status);
    console.log("Payment Amount:", payment.amount);
    console.log("Payment Email:", payment.email);
    console.log("Payment Description:", payment.description);
    console.log("Order ID:", payment.order_id);
    console.log("Payment Notes:", JSON.stringify(payment.notes, null, 2));

    // Verify payment is actually captured
    if (payment.status !== "captured") {
      console.log(`❌ Payment ${payment.id} status is not captured. Status: ${payment.status}`);
      return res.json({ message: "Payment not successful" });
    }

    // 🎯 Check if this is an order payment (one-time) or subscription payment
    const isOrderPayment = payment.order_id && payment.order_id.startsWith("order_");
    const isSubscriptionPayment = payment.subscription_id && payment.subscription_id.startsWith("sub_");

    console.log("🔍 Payment Type Detection:");
    console.log("Order ID:", payment.order_id);
    console.log("Subscription ID:", payment.subscription_id);
    console.log("Is Order Payment:", isOrderPayment);
    console.log("Is Subscription Payment:", isSubscriptionPayment);

    if (isOrderPayment) {
      console.log("🎯 Detected ORDER PAYMENT - Processing as one-time payment");
      return await handleOrderPaymentCaptured(payment, req, res);
    }

    // Continue with existing subscription payment logic
    console.log("🎯 Processing as SUBSCRIPTION PAYMENT");

    // Find user by email
    const user = await User.findOne({ email: payment.email });
    if (!user) {
      console.error("❌ User not found for payment email:", payment.email);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", user.email);

    // Determine plan and subscription details
    let plan = null;
    let subscription = null;
    let isRecurring = false;

    // Try to find subscription from payment
    if (payment.subscription_id) {
      try {
        subscription = await razorpay.subscriptions.fetch(payment.subscription_id);
        console.log("✅ Subscription found:", subscription.id, subscription.status);
        
        // Find plan by subscription plan_id
        plan = await Plan.findOne({ razorpayPlanId: subscription.plan_id });
        if (plan) {
          console.log("✅ Plan found by subscription:", plan.title);
          isRecurring = subscription.total_count > 1;
        }
      } catch (error) {
        console.error("❌ Error fetching subscription:", error);
      }
    }

    // If no subscription, try to find plan by amount or description
    if (!plan) {
      console.log("🔍 No subscription found - trying to match plan by amount/description");
      
      const allPlans = await Plan.find({});
      
      // Try to match by amount (convert to paise if needed)
      for (const p of allPlans) {
        if (p.price && (p.price * 100 === payment.amount || p.price === payment.amount)) {
          plan = p;
          console.log(`✅ Plan matched by amount: ${p.title} (${p.price})`);
          break;
        }
      }

      // If no amount match, try to match by description
      if (!plan && payment.description) {
        for (const p of allPlans) {
          if (p.title.toLowerCase().includes(payment.description.toLowerCase()) ||
              payment.description.toLowerCase().includes(p.title.toLowerCase())) {
            plan = p;
            console.log(`✅ Plan matched by description: ${p.title}`);
            break;
          }
        }
      }

      // Check if user has a stored payment type preference
      if (plan) {
        const userPaymentType = user.subscription?.paymentType;
        isRecurring = userPaymentType === "recurring";
        console.log(`Payment type from user preference: ${userPaymentType}, isRecurring: ${isRecurring}`);
      }
    }

    if (!plan) {
      console.error("❌ Could not determine plan for payment");
      console.error("Available plans:", (await Plan.find({})).map(p => `${p.title}: ${p.price}`));
      return res.status(400).json({ error: "Plan not found" });
    }

    // Calculate expiry date
    let expiry = null;
    if (subscription?.current_end) {
      expiry = new Date(subscription.current_end * 1000);
      console.log("📅 Using subscription end date:", expiry);
    } else {
      const { expiryDate } = calculateSubscriptionDates(plan.interval);
      expiry = expiryDate;
      console.log("📅 Calculated expiry from plan interval:", expiry);
    }

    if (!expiry || expiry <= new Date()) {
      console.error("❌ Invalid expiry date calculated:", expiry);
      return res.status(400).json({ error: "Invalid expiry date calculated" });
    }

    console.log("=== UPDATING USER DATABASE ===");
    console.log("User:", user.email);
    console.log("Plan:", plan.title);
    console.log("Expiry:", expiry);
    console.log("Is Recurring:", isRecurring);
    console.log("=============================");

    // Update user subscription
    const updateResult = await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.free": false,
        "subscription.plan": plan._id,
        "subscription.status": "active",
        "subscription.purchaseDate": new Date(),
        "subscription.startDate": new Date(),
        "subscription.expire": expiry,
        "subscription.auto_pay": isRecurring,
        "subscription.autoRenewalCount": 0,
        "razorpay.subscriptionId": subscription?.id || null,
      },
    }, { new: true });

    console.log("✅ USER UPDATED SUCCESSFULLY:", updateResult?.email);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name || "User");
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error("❌ Failed to send welcome email:", error);
    }

    // Create payment record
    const paymentRecord = await Payment.create({
      amount: payment.amount,
      currency: payment.currency.toLowerCase(),
      paymentStatus: "completed",
      paymentGateway: "razorpay",
      paymentMethod: payment.method,
      paymentId: payment.id,
      invoice: payment.invoice_id || null,
      user: user._id,
      plan: plan._id,
      purchaseDate: new Date(),
    });

    console.log("✅ PAYMENT RECORD CREATED:", paymentRecord._id);

    return res.json({
      message: "Payment processed successfully",
      user: user.email,
      plan: plan.title,
      payment: payment.id
    });

  } catch (error) {
    console.error("Error in handlePaymentCaptured:", error);
    return res.status(500).json({ error: "Failed to process payment" });
  }
}

async function handlePaymentFailed(req: express.Request, res: express.Response) {
  try {
    const payment = req.body.payload.payment.entity;
    console.log("=== PAYMENT FAILED EVENT RECEIVED ===");
    console.log("Payment ID:", payment.id);
    console.log("Payment Status:", payment.status);
    console.log("Failure Reason:", payment.error_code);
    console.log("Failure Description:", payment.error_description);

    // Find user by payment email
    const user = await User.findOne({ email: payment.email });
    if (user) {
      // Get failed payment timestamp (Razorpay uses Unix timestamp in seconds)
      const failedPaymentTimestamp = payment.created_at 
        ? new Date(payment.created_at * 1000) 
        : new Date();
      
      console.log(`Payment failed for user ${user.email} at ${failedPaymentTimestamp}`);
      console.log(`ℹ️ No subscription changes will be made - only recording failed payment for tracking`);

      // 🔒 CRITICAL: Do NOT reset subscription on failed payment
      // Failed payment webhooks can arrive out of order (e.g., old failed payment arrives after newer successful payment)
      // We only record the failed payment for tracking purposes without modifying user subscription

      // Create failed payment record for tracking only
      await Payment.create({
        amount: payment.amount,
        currency: payment.currency.toLowerCase(),
        paymentStatus: "failed",
        paymentGateway: "razorpay",
        paymentMethod: payment.method,
        paymentId: payment.id,
        invoice: payment.invoice_id || null,
        user: user._id,
        plan: null,
        purchaseDate: failedPaymentTimestamp,
        failureReason: payment.error_code || "Payment failed",
        failureDescription: payment.error_description || "Payment processing failed",
      });

      console.log(`✅ Failed payment record created for user ${user.email}`);
    } else {
      console.error("User not found for failed payment email:", payment.email);
    }

    return res.json({ message: "Payment failure processed (no subscription changes made)" });

  } catch (error) {
    console.error("Error in handlePaymentFailed:", error);
    return res.status(500).json({ error: "Failed to process payment failure" });
  }
}

async function handleSubscriptionCancelled(req: express.Request, res: express.Response) {
  try {
    const subscription = req.body.payload.subscription.entity;
    console.log("=== SUBSCRIPTION CANCELLED EVENT RECEIVED ===");
    console.log("Subscription ID:", subscription.id);

    await User.findOneAndUpdate(
      { "razorpay.subscriptionId": subscription.id },
      {
        $set: {
          "subscription.free": false,
          "subscription.auto_pay": false,
        },
      }
    );

    console.log("✅ Subscription cancelled for user");
    return res.json({ message: "Subscription cancelled processed" });

  } catch (error) {
    console.error("Error in handleSubscriptionCancelled:", error);
    return res.status(500).json({ error: "Failed to process subscription cancellation" });
  }
}

async function handleSubscriptionPaused(req: express.Request, res: express.Response) {
  try {
    const subscription = req.body.payload.subscription.entity;
    console.log("=== SUBSCRIPTION PAUSED EVENT RECEIVED ===");
    console.log("Subscription ID:", subscription.id);

    await User.findOneAndUpdate(
      { "razorpay.subscriptionId": subscription.id },
      {
        $set: {
          "subscription.free": false,
          "subscription.auto_pay": false
        }
      }
    );

    console.log("✅ Subscription paused for user");
    return res.json({ message: "Subscription paused processed" });

  } catch (error) {
    console.error("Error in handleSubscriptionPaused:", error);
    return res.status(500).json({ error: "Failed to process subscription pause" });
  }
}

async function handleSubscriptionResumed(req: express.Request, res: express.Response) {
  try {
    const subscription = req.body.payload.subscription.entity;
    console.log("=== SUBSCRIPTION RESUMED EVENT RECEIVED ===");
    console.log("Subscription ID:", subscription.id);

    await User.findOneAndUpdate(
      { "razorpay.subscriptionId": subscription.id },
      {
        $set: {
          "subscription.free": false,
          "subscription.auto_pay": true
        }
      }
    );

    console.log("✅ Subscription resumed for user");
    return res.json({ message: "Subscription resumed processed" });

  } catch (error) {
    console.error("Error in handleSubscriptionResumed:", error);
    return res.status(500).json({ error: "Failed to process subscription resume" });
  }
}

async function handleSubscriptionUpdated(req: express.Request, res: express.Response) {
  try {
    const subscription = req.body.payload.subscription.entity;
    console.log("=== SUBSCRIPTION UPDATED EVENT RECEIVED ===");
    console.log("Subscription ID:", subscription.id);

    const user = await User.findOne({ "razorpay.subscriptionId": subscription.id });
    if (user) {
      const currentCount = user.subscription?.autoRenewalCount || 0;
      const newCount = currentCount + 1;
      const shouldDisableAutoPay = newCount >= 2;

      const updateData: any = {
        "subscription.free": false,
        "subscription.expire": new Date(subscription.current_end * 1000),
        "subscription.autoRenewalCount": newCount,
        "subscription.startDate": new Date(),
      };

      if (shouldDisableAutoPay) {
        updateData["subscription.auto_pay"] = false;
      }

      await User.findOneAndUpdate(
        { "razorpay.subscriptionId": subscription.id },
        { $set: updateData }
      );

      console.log("✅ Subscription updated for user");
    }

    return res.json({ message: "Subscription updated processed" });

  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error);
    return res.status(500).json({ error: "Failed to process subscription update" });
  }
}

// 🎯 Handle order payment captured (for one-time payments via payment.captured event)
async function handleOrderPaymentCaptured(payment: any, req: express.Request, res: express.Response) {
  try {
    console.log("=== ORDER PAYMENT CAPTURED ===");
    console.log("Payment ID:", payment.id);
    console.log("Order ID:", payment.order_id);
    console.log("Payment Status:", payment.status);
    console.log("Payment Email:", payment.email);
    console.log("Payment Notes:", JSON.stringify(payment.notes, null, 2));
    console.log("===============================");

    // Find user by order ID first
    let user = await User.findOne({ "razorpay.orderId": payment.order_id });
    
    // Fallback: find user by email
    if (!user) {
      console.log("User not found by orderId, trying email:", payment.email);
      user = await User.findOne({ email: payment.email });
    }

    // Fallback: find user by ID from notes
    if (!user && payment.notes?.user_id) {
      console.log("User not found by email, trying notes.user_id:", payment.notes.user_id);
      user = await User.findById(payment.notes.user_id);
    }

    if (!user) {
      console.error("❌ User not found for order payment");
      console.error("Order ID:", payment.order_id);
      console.error("Email:", payment.email);
      console.error("Notes:", payment.notes);
      return res.status(404).json({ error: "User not found for order payment" });
    }

    console.log("✅ User found:", user.email);

    // Get plan from payment notes or find by amount
    let plan = null;
    if (payment.notes?.plan_id) {
      plan = await Plan.findById(payment.notes.plan_id);
      console.log("✅ Plan found from notes:", plan?.title);
    }

    // Fallback: find plan by amount
    if (!plan) {
      console.log("🔍 Plan not found in notes, searching by amount:", payment.amount);
      const allPlans = await Plan.find({});
      for (const p of allPlans) {
        if (p.price && (p.price * 100 === payment.amount || p.price === payment.amount)) {
          plan = p;
          console.log("✅ Plan found by amount:", p.title);
          break;
        }
      }
    }

    if (!plan) {
      console.error("❌ Plan not found for order payment");
      console.error("Available plans:", (await Plan.find({})).map(p => `${p.title}: ${p.price}`));
      return res.status(400).json({ error: "Plan not found" });
    }

    // Calculate expiry date
    const { expiryDate } = calculateSubscriptionDates(plan.interval);
    
    console.log("=== UPDATING USER FOR ORDER PAYMENT ===");
    console.log("User:", user.email);
    console.log("Plan:", plan.title);
    console.log("Expiry:", expiryDate);
    console.log("Auto Pay: false (one-time payment)");
    console.log("========================================");

    // Update user subscription (matching exact fields as subscription handler)
    const updateResult = await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.free": false,
        "subscription.plan": plan._id,
        "subscription.status": "active",
        "subscription.purchaseDate": new Date(),
        "subscription.startDate": new Date(),
        "subscription.expire": expiryDate,
        "subscription.auto_pay": false, // ✅ No auto-pay for one-time payments
        "subscription.autoRenewalCount": 0,
      },
      $unset: {
        "razorpay.orderId": "" // ✅ Clean up order ID after processing
      }
    }, { new: true });

    console.log("✅ USER UPDATED SUCCESSFULLY:", updateResult?.email);

    // Create payment record
    const paymentRecord = await Payment.create({
      amount: payment.amount , // Convert from paise to rupees
      currency: payment.currency.toLowerCase(),
      paymentStatus: "completed",
      paymentGateway: "razorpay",
      paymentMethod: payment.method,
      paymentId: payment.id,
      user: user._id,
      plan: plan._id,
      purchaseDate: new Date(),
    });

    console.log("✅ PAYMENT RECORD CREATED:", paymentRecord._id);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name || "User");
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error("❌ Failed to send welcome email:", error);
    }

    return res.json({
      message: "Order payment processed successfully",
      user: user.email,
      plan: plan.title,
      payment: payment.id,
      order: payment.order_id
    });

  } catch (error) {
    console.error("Error in handleOrderPaymentCaptured:", error);
    return res.status(500).json({ error: "Failed to process order payment" });
  }
}

async function handleOrderPaid(req: express.Request, res: express.Response) {
  try {
    const order = req.body.payload.order.entity;
    const payment = req.body.payload.payment.entity;
    
    console.log("=== ORDER PAID EVENT RECEIVED ===");
    console.log("Order ID:", order.id);
    console.log("Payment ID:", payment.id);
    console.log("Order Amount:", order.amount);
    console.log("Payment Status:", payment.status);
    console.log("Payment Method:", payment.method);
    console.log("Order Notes:", JSON.stringify(order.notes, null, 2));
    console.log("==================================");

    // Find user by order ID
    let user = await User.findOne({ "razorpay.orderId": order.id });
    
    // Fallback: find user by ID from notes
    if (!user && order.notes?.user_id) {
      console.log("User not found by orderId, trying notes.user_id:", order.notes.user_id);
      user = await User.findById(order.notes.user_id);
    }

    if (!user) {
      console.error("❌ User not found for order:", order.id);
      console.error("Available order notes:", order.notes);
      return res.status(404).json({ error: "User not found for order" });
    }

    console.log("✅ User found:", user.email);

    // Get plan from order notes
    const planId = order.notes.plan_id;
    if (!planId) {
      console.error("❌ Plan ID not found in order notes");
      return res.status(400).json({ error: "Plan ID not found in order" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      console.error("❌ Plan not found:", planId);
      return res.status(404).json({ error: "Plan not found" });
    }

    console.log("✅ Plan found:", plan.title);

    // Verify payment status
    if (payment.status !== "captured") {
      console.error("❌ Payment not captured. Status:", payment.status);
      return res.status(400).json({ error: "Payment not captured" });
    }

    // Calculate expiry date based on plan interval
    const { expiryDate } = calculateSubscriptionDates(plan.interval);
    
    console.log("=== UPDATING USER FOR ONE-TIME PAYMENT ===");
    console.log("User:", user.email);
    console.log("Plan:", plan.title);
    console.log("Expiry:", expiryDate);
    console.log("Auto Pay: false (one-time payment)");
    console.log("==========================================");

    // Update user subscription for one-time payment (matching exact fields as subscription handler)
    const updateResult = await User.findByIdAndUpdate(user._id, {
      $set: {
        "subscription.free": false,
        "subscription.plan": plan._id,
        "subscription.status": "active",
        "subscription.purchaseDate": new Date(),
        "subscription.startDate": new Date(),
        "subscription.expire": expiryDate,
        "subscription.auto_pay": false, // ✅ No auto-pay for one-time payments
        "subscription.autoRenewalCount": 0,
      },
      $unset: {
        "razorpay.orderId": "" // ✅ Clean up order ID after processing
      }
    }, { new: true });

    console.log("✅ USER UPDATED SUCCESSFULLY:", updateResult?.email);

    // Create payment record
    const paymentRecord = await Payment.create({
      amount: payment.amount, // Convert from paise to rupees
      currency: payment.currency.toLowerCase(),
      paymentStatus: "completed",
      paymentGateway: "razorpay",
      paymentMethod: payment.method,
      paymentId: payment.id,
      user: user._id,
      plan: plan._id,
      purchaseDate: new Date(),
    });

    console.log("✅ Payment record created:", paymentRecord._id);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name || "User");
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error("❌ Failed to send welcome email:", error);
    }

    return res.json({
      message: "One-time payment processed successfully",
      user: user.email,
      plan: plan.title,
      payment: payment.id,
      order: order.id
    });

  } catch (error) {
    console.error("Error in handleOrderPaid:", error);
    return res.status(500).json({ error: "Failed to process order payment" });
  }
}

async function handleCustomWebhook(req: express.Request, res: express.Response) {
      try {
        const subscription = await razorpay.subscriptions.fetch(req.body.razorpay_subscription_id);
        const payment = await razorpay.payments.fetch(req.body.razorpay_payment_id);

        if (subscription.status !== "active" && subscription.status !== "authenticated") {
          return res.json({ message: "Subscription not in valid state" });
        }

        if (payment.status !== "captured") {
          console.log(`❌ Payment ${payment.id} status is not captured. Status: ${payment.status}`);
          return res.json({ message: "Payment not successful" });
        }

        const user = await User.findOne({ "razorpay.subscriptionId": req.body.razorpay_subscription_id });
        if (!user) {
          console.error("User not found for subscription ID:", req.body.razorpay_subscription_id);
          return res.status(404).json({ error: "User not found" });
        }

        const plan = await Plan.findOne({ razorpayPlanId: subscription.plan_id });
        if (!plan) {
      console.error("Plan not found for subscription plan_id:", subscription.plan_id);
          return res.status(404).json({ error: "Plan not found" });
        }

        let expiry = null;
        if (subscription?.current_end) {
          expiry = new Date(subscription.current_end * 1000);
        } else if (subscription?.end_at) {
          expiry = new Date(subscription.end_at * 1000);
        } else {
          const { expiryDate } = calculateSubscriptionDates(plan.interval);
          expiry = expiryDate;
        }

        if (!expiry || expiry <= new Date()) {
          console.error("❌ Invalid expiry date calculated:", expiry);
          return res.status(400).json({ error: "Invalid expiry date calculated" });
        }

        const autoPayEnabled = subscription.total_count > 1;

        const updateResult = await User.findByIdAndUpdate(user._id, {
          $set: {
            "subscription.free": false,
            "subscription.plan": plan._id,
            "subscription.status": "active",
            "subscription.purchaseDate": new Date(),
            "subscription.startDate": new Date(),
            "subscription.expire": expiry,
            "subscription.auto_pay": autoPayEnabled,
            "subscription.autoRenewalCount": 0,
          },
        });

        console.log("✅ USER UPDATED SUCCESSFULLY:", updateResult);

        try {
          await sendWelcomeEmail(user.email, user.name || "User");
          console.log(`Welcome email sent to ${user.email} for plan activation`);
        } catch (error) {
          console.error("Failed to send welcome email:", error);
        }

        const paymentRecord = await Payment.create({
          amount: payment.amount,
          currency: payment.currency.toLowerCase(),
          paymentStatus: "completed",
          paymentGateway: "razorpay",
          paymentMethod: payment.method,
          paymentId: payment.id,
          invoice: null,
          user: user._id,
          plan: plan._id,
          purchaseDate: new Date(),
        });

        console.log("✅ PAYMENT RECORD CREATED:", paymentRecord);

        return res.json({
          message: "Custom webhook processed successfully",
          user: user.email,
          subscription: subscription.id,
          payment: payment.id
        });

      } catch (error) {
        console.error("Error processing custom webhook:", error);
        return res.status(500).json({ error: "Failed to process custom webhook" });
      }
    }

export const createWebhook = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { url, account_id } = req.body;
    const webhook = await razorpay.webhooks.create(
      {
        url: url,
        secret: "12345",
        alert_email: "support@pilotshala.com",
        active: "true",
        events: [
          "payment.captured",     // Successful payment
          "payment.failed",       // Track failed payments
          "subscription.activated", // Subscription created
          "subscription.cancelled", // Subscription cancelled
          "subscription.paused",   // Subscription paused
          "subscription.resumed",  // Subscription resumed
          "subscription.updated",  // Subscription updated (renewals)
        ],
      },
      account_id
    );

    return res.json(webhook);
  } catch (error) {
    console.error("Error creating webhook:", error);
    return res.status(500).json({ error: "Failed to create webhook" });
  }
};
