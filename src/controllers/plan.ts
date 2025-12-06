import express from "express";
import { Plan, User, Payment } from "../models/index.js";
import Stripe from "stripe";
import Razorpay from "razorpay";
import { AUTH_COOKIE_NAME } from "../utils/constants.js";
import { verifyToken } from "../utils/jwt.js";
import { calculateSubscriptionDates } from "../utils/expiry.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("Razorpay configuration missing. Please check environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createPlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { title, price, interval, description, currency } = req.body;

    const alreadyExists = await Plan.findOne({ title, interval });

    if (alreadyExists)
      return res
        .status(400)
        .json({ error: `${interval} ${title} plan already exists` });
    if (!title || !price || !interval)
      return res.status(400).json({ error: "All fields are required" });
    if (price <= 0)
      return res.status(400).json({ error: "Price must be greater than 0" });
    if (
      interval !== "monthly" &&
      interval !== "quarterly" &&
      interval !== "yearly" &&
      interval !== "half-yearly" &&
      interval !== "weekly"
    )
      return res.status(400).json({
        error: "Billing interval must be weekly, monthly, quarterly, half-yearly, or yearly",
      });

    let recurring: any = {
      interval: "monthly",
      interval_count: 6,
    };

    if (interval === "monthly")
      recurring = {
        interval: "monthly",
        interval_count: 1,
      };
    else if (interval === "quarterly")
      recurring = {
        interval: "monthly",
        interval_count: 3,
      };
    else if (interval === "yearly")
      recurring = {
        interval: "yearly",
        interval_count: 1,
      };
    else if (interval === "weekly")
      recurring = {
        interval: "weekly",
        interval_count: 1,
      };

    let razorpayPlan = null;
    let stripePrice = null;

    try {
      razorpayPlan = await razorpay.plans.create({
        period: recurring.interval,
        interval: recurring.interval_count,
        item: {
          name: title,
          description,
          currency: "INR",
          amount: price * 100,
        },
      });
    } catch (err) {
      console.error("Razorpay plan creation error:", err);
      return res.status(400).json({
        error: "Razorpay plan creation failed",
      });
    }

    // const product = await stripe.products.create({ name: title });
    // stripePrice = await stripe.prices.create({
    //   product: product.id,
    //   unit_amount: price * 100,
    //   currency: currency || "inr",
    //   recurring,
    // });

    const saved = await Plan.create({
      title,
      description,
      price,
      interval,
      razorpayPlanId: razorpayPlan?.id,
    });

    return res.json(saved);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getPlans = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const plans = await Plan.find({}).sort({ createdAt: -1 });
    return res.json(plans);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getActivePlans = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const token =
      req.cookies[AUTH_COOKIE_NAME] || req.headers.authorization?.split(" ")[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user?.email === "65ranjha@gmail.com") {
        const plans = await Plan.find({}).sort({ createdAt: -1 });
        return res.json(plans);
      }
    }

    const plans = await Plan.find({ isActive: true }).sort({ createdAt: -1 });
    return res.json(plans);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const getPlanById = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    return res.json(plan);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const subscribePlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const user = req.user;

    const { gateway, paymentType } = req.query;
    console.log(id,user,paymentType)

    if (!gateway)
      return res.status(400).json({ error: "Payment gateway is required" });
    if (gateway !== "razorpay")
      return res
        .status(400)
        .json({ error: "Payment gateway must be razorpay" });
    
    // Validate payment type
    if (!paymentType || (paymentType !== "one-time" && paymentType !== "recurring")) {
      return res.status(400).json({ 
        error: "Payment type is required and must be either 'one-time' or 'recurring'" 
      });
    }

    // Check if user already has a subscription
    if (user?.subscription?.plan && user?.subscription?.status === "active") {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "subscription.plan": null,
          "subscription.status": null,
          "subscription.gateway": null,
          "subscription.expire": null,
          "razorpay.subscriptionId": null,
        },
      });
    }

    const plan = await Plan.findById(id);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    let session: any = null;

    if (gateway === "razorpay") {
      try {
        let customerId = user.razorpay.customerId;
        if (!customerId) {
          const customer = await razorpay.customers.create({
            name: user.name,
            email: user.email,
            contact: user.phone || "",
          });

          customerId = customer.id;

          await User.findByIdAndUpdate(user._id, {
            razorpay: {
              customerId,
            },
          });
        }
      } catch (error) {
        console.log("Error creating Razorpay customer:", error);
      }

      let order: any = null;

      console.log("=== PAYMENT TYPE DEBUG ===");
      console.log("Payment type:", paymentType);
      console.log("Plan:", plan.title, "Price:", plan.price);
      console.log("===========================");

      if (paymentType === "one-time") {
        // ✅ Use Orders API for one-time payments (no auto-pay message in UPI)
        console.log("Creating one-time payment order...");
        
        order = await razorpay.orders.create({
          amount: plan.price * 100, // Amount in paise
          currency: 'INR',
          receipt: `order_${user._id}`,
          notes: {
            plan_id: plan._id.toString(),
            user_id: user._id.toString(),
            payment_type: 'one-time',
            plan_title: plan.title
          }
        });

        console.log("=== ONE-TIME ORDER CREATED ===");
        console.log("Order ID:", order.id);
        console.log("Amount:", order.amount);
        console.log("Currency:", order.currency);
        console.log("===============================");

        // Store order info for one-time payment
        await User.findByIdAndUpdate(user._id, {
          $set: {
            "razorpay.orderId": order.id,
            "subscription.plan": plan._id,
            "subscription.gateway": "razorpay",
            "subscription.paymentType": paymentType,
          },
        });

        console.log("✅ Order ID stored in user record:", order.id);

      } else {
        // ✅ Use Subscriptions API for recurring payments (shows auto-pay message)
        console.log("Creating recurring subscription...");
        
        let subscriptionId = user.razorpay.subscriptionId;
        const count = 2; // Initial + 1 auto-renewal for recurring

        // Try to fetch the plan from Razorpay first
        try {
          console.log("Attempting to fetch Razorpay plan with ID:", `"${plan.razorpayPlanId}"`);
          const razorpayPlan = await razorpay.plans.fetch(plan.razorpayPlanId);
          console.log("✅ Razorpay plan found:", razorpayPlan.id);
        } catch (fetchError:any) {
          console.error("❌ Razorpay plan fetch failed:", fetchError);
          console.error("Error details:", {
            statusCode: fetchError.statusCode,
            code: fetchError.error?.code,
            description: fetchError.error?.description,
            message: fetchError.message
          });
          return res.status(400).json({ 
            error: `Razorpay plan not found: ${fetchError?.message}` 
          });
        }

        if (
          subscriptionId &&
          user.subscription?.plan === plan._id &&
          subscriptionId.startsWith("sub_")
        ) {
          order = await razorpay.subscriptions.fetch(subscriptionId);
        } else {
          order = await razorpay.subscriptions.create({
            plan_id: plan.razorpayPlanId,
            total_count: count,
            customer_notify: 1,
            quantity: 1,
          });
        }

        console.log("=== RECURRING SUBSCRIPTION CREATED ===");
        console.log("Subscription ID:", order.id);
        console.log("Plan ID:", plan._id);
        console.log("Total count:", count);
        console.log("=======================================");

        // Store subscription info for recurring payment
        await User.findByIdAndUpdate(user._id, {
          $set: {
            "razorpay.subscriptionId": order.id,
            "subscription.plan": plan._id,
            "subscription.gateway": "razorpay",
            "subscription.paymentType": paymentType,
          },
        });

        console.log("✅ Subscription ID stored in user record:", order.id);
      }

      session = order;
    }

    // Normalize response for frontend compatibility
    const response = {
      ...session,
      payment_type: paymentType,
      is_subscription: paymentType === "recurring"
    };

    return res.json(response);
  } catch (error: any) {
    console.log("Error in subscribePlan:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const confirmRazorpayPayment = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    console.log("=== FRONTEND PAYMENT CONFIRMATION ===");
    console.log("Request body:", req.body);
    
    // Extract payment details directly from request body or from formData
    const paymentData = req.body.formData || req.body;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, razorpay_subscription_id } = paymentData;
    
    console.log("Payment ID:", razorpay_payment_id);
    console.log("Order ID:", razorpay_order_id);
    console.log("Signature:", razorpay_signature);
    
    // For now, just return success - webhook will handle the actual processing
    // You could add signature verification here if needed
    
    // 🔧 MANUAL PROCESSING - Only for ORDER payments (one-time), not subscriptions
    // Check if this is an order payment (one-time) that needs manual processing
    const isOrderPayment = razorpay_order_id && razorpay_order_id.startsWith("order_");
    const isSubscriptionPayment = razorpay_subscription_id || !isOrderPayment;

    if (isOrderPayment) {
      console.log("🔧 MANUAL PROCESSING: Order payment detected, processing manually");
      
      try {
        // Find the user
        const user = await User.findById(req.user._id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Only process if user has this order ID stored
        if (user.razorpay?.orderId === razorpay_order_id) {
          // Get plan from user's stored order
          let plan = null;
          if (user.subscription?.plan) {
            plan = await Plan.findById(user.subscription.plan);
            console.log("✅ Plan found from user subscription:", plan?.title);
          }

          // If no plan found, fetch the order from Razorpay to get plan details
          if (!plan) {
            console.log("Plan not found from user subscription, fetching order from Razorpay");
            try {
              const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
              console.log("Razorpay order notes:", razorpayOrder.notes);
              
              if (razorpayOrder.notes?.plan_id) {
                plan = await Plan.findById(razorpayOrder.notes.plan_id);
                console.log("✅ Plan found from Razorpay order notes:", plan?.title);
              }
            } catch (error) {
              console.error("Error fetching order from Razorpay:", error);
            }
          }

          if (plan) {
            // Calculate expiry date
            const { expiryDate } = calculateSubscriptionDates(plan.interval);
            
            console.log("🔧 MANUAL UPDATE: Updating user subscription for ORDER payment");
            console.log("User:", user.email);
            console.log("Plan:", plan.title);
            console.log("Expiry:", expiryDate);

            // Update user subscription
            await User.findByIdAndUpdate(user._id, {
              $set: {
                "subscription.free": false,
                "subscription.plan": plan._id,
                "subscription.status": "active",
                "subscription.purchaseDate": new Date(),
                "subscription.startDate": new Date(),
                "subscription.expire": expiryDate,
                "subscription.auto_pay": false, // ✅ One-time payment = no auto-pay
                "subscription.autoRenewalCount": 0,
              },
              $unset: {
                "razorpay.orderId": ""
              }
            });

            // Create payment record
            await Payment.create({
              amount: plan.price*100,
              currency: "inr",
              paymentStatus: "completed",
              paymentGateway: "razorpay",
              paymentMethod: "card",
              paymentId: razorpay_payment_id,
              user: user._id,
              plan: plan._id,
              purchaseDate: new Date(),
            });

            console.log("✅ MANUAL ORDER PROCESSING COMPLETED");
          }
        } else {
          console.log("Order ID doesn't match user's stored order, skipping manual processing");
        }
      } catch (error) {
        console.error("Error in manual order processing:", error);
      }
    } else {
      console.log("🔄 SUBSCRIPTION PAYMENT: Letting webhook handle processing (no manual intervention)");
    }

    return res.json({
      success: true,
      message: "Payment confirmed and processed successfully!",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id
    });
    
  } catch (error: any) {
    console.error("Error in confirmRazorpayPayment:", error);
    return res.status(500).json({ error: error?.message });
  }
};

export const cancelPlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;

    if (!user.stripe.customerId && !user.razorpay.customerId) {
      return res.status(404).json({ error: "No payments found" });
    }

    if (user?.razorpay.subscriptionId.startsWith("order_")) {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "razorpay.subscriptionId": null,
          "subscription.status": null,
          "subscription.gateway": null,
          "subscription.plan": null,
          "subscription.expire": null,
          "subscription.free": false,
          "subscription.autoRenewalCount": 0,
        },
      }); 
    } else {
      try {
        await razorpay.subscriptions.cancel(user.razorpay.subscriptionId || "");
        await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              "razorpay.subscriptionId": null,
              "subscription.status": null,
              "subscription.gateway": null,
              "subscription.plan": null,
              "subscription.expire": null,
              "subscription.autoRenewalCount": 0,
            },
          },
          {
            new: true,
          }
        );
      } catch (error) {
        console.error("Error cancelling Razorpay subscription:", error);
        return res.status(400).json({ error: "Failed to cancel subscription" });
      }
    }

    return res.json({ message: "Subscription cancelled successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const updatePlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    let { title, description, isActive } = req.body;

    if (!title)
      return res.status(400).json({ error: "All fields are required" });

    const plan = await Plan.findByIdAndUpdate(
      id,
      { title, description, isActive },
      { new: true }
    );

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    return res.json(plan);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const deletePlan = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;

    const plan = await Plan.findByIdAndDelete(id);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    return res.json({ message: "Plan deleted successfully" });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message });
  }
};

export const pauseSubscription = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;

    // Check if user has a valid subscription
    if (!user.subscription?.plan || (user.subscription?.status !== "active" && user.subscription?.status !== null)) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    if (user?.razorpay?.subscriptionId?.startsWith("sub_")) {
      await razorpay.subscriptions.pause(user.razorpay.subscriptionId || "");

      await User.findByIdAndUpdate(
        user?._id,
        { $set: { "subscription.auto_pay": false } },
        { new: true }
      );
      return res.json({ message: "Auto Renewal paused successfully" });
    } else {
      return res.status(400).json({ error: "No active subscription found" });
    }
  } catch (error: any) {
    console.error("Error pausing subscription:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const resumeSubscription = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;

    // Check if user has a valid subscription
    if (!user.subscription?.plan || (user.subscription?.status !== "active" && user.subscription?.status !== null)) {
      return res.status(400).json({ error: "No active subscription found" });
    }

    if (user?.razorpay?.subscriptionId?.startsWith("sub_")) {
      await razorpay.subscriptions.resume(user.razorpay.subscriptionId || "");

      await User.findByIdAndUpdate(
        user?._id,
        { $set: { "subscription.auto_pay": true } },
        { new: true }
      );
      return res.json({ message: "Auto Renewal resumed successfully" });
    } else {
      return res.status(400).json({ error: "No active subscription found" });
    }
  } catch (error: any) {
    console.error("Error resuming subscription:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const cancelAutoRenewal = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;

    console.log("=== CANCEL AUTO-RENEWAL REQUEST ===");
    console.log("User ID:", user?._id);
    console.log("User subscription status:", user?.subscription?.status);
    console.log("User subscription plan:", user?.subscription?.plan);
    console.log("User auto_pay status:", user?.subscription?.auto_pay);
    console.log("User Razorpay subscription ID:", user?.razorpay?.subscriptionId);
    console.log("=====================================");

    // Check if user exists and has a subscription
    if (!user) {
      console.error("User not authenticated in cancelAutoRenewal");
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!user.subscription?.plan || (user.subscription?.status !== "active" && user.subscription?.status !== null)) {
      console.error("No active subscription found for user:", user._id);
      return res.status(400).json({ error: "No active subscription found" });
    }

    // Cancel auto-renewal on Razorpay if subscription exists
    if (user?.razorpay?.subscriptionId && user.razorpay.subscriptionId.startsWith("sub_")) {
      try {
        console.log("Attempting to cancel Razorpay subscription:", user.razorpay.subscriptionId);
        await razorpay.subscriptions.cancel(user.razorpay.subscriptionId);
        console.log(`Successfully cancelled Razorpay subscription: ${user.razorpay.subscriptionId}`);
      } catch (error: any) {
        console.error("Error cancelling Razorpay auto-renewal:", error);
        console.error("Error details:", {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        // Don't return error here, continue with local database update
        // The subscription might already be cancelled or in a different state
      }
    } else {
      console.log("No valid Razorpay subscription ID found, skipping Razorpay cancellation");
    }

    // Update local database to disable auto-renewal
    try {
      console.log("Updating local database to disable auto-renewal for user:", user._id);
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $set: { 
            "subscription.auto_pay": false,
            "subscription.autoRenewalCount": 0
          } 
        },
        { new: true }
      );

      if (!updatedUser) {
        console.error("User not found during database update:", user._id);
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`Successfully disabled auto-renewal for user: ${user._id}`);
      console.log("Updated user auto_pay status:", updatedUser.subscription?.auto_pay);
      console.log("Updated user autoRenewalCount:", updatedUser.subscription?.autoRenewalCount);
      
      return res.json({ 
        message: "Auto-renewal cancelled successfully",
        auto_pay: false,
        autoRenewalCount: 0
      });
    } catch (dbError: any) {
      console.error("Database error while cancelling auto-renewal:", dbError);
      console.error("Database error details:", {
        message: dbError.message,
        code: dbError.code,
        name: dbError.name
      });
      return res.status(500).json({ error: "Failed to update subscription settings" });
    }
  } catch (error: any) {
    console.error("Unexpected error in cancelAutoRenewal:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
};

export const manualRenewSubscription = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const user = req.user;
    const { planId, paymentType } = req.body;

    if (!planId) {
      return res.status(400).json({ error: "Plan ID is required" });
    }

    if (!paymentType || (paymentType !== "one-time" && paymentType !== "recurring")) {
      return res.status(400).json({ 
        error: "Payment type is required and must be either 'one-time' or 'recurring'" 
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Cancel existing subscription if any
    if (user?.razorpay?.subscriptionId?.startsWith("sub_")) {
      try {
        await razorpay.subscriptions.cancel(user.razorpay.subscriptionId || "");
      } catch (error) {
        console.error("Error cancelling existing subscription:", error);
      }
    }

    // Create new subscription based on payment type
    let customerId = user.razorpay.customerId;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: user.name,
        email: user.email,
        contact: user.phone || "",
      });
      customerId = customer.id;

      await User.findByIdAndUpdate(user._id, {
        razorpay: {
          customerId,
        },
      });
    }

    // Determine total_count based on payment type
    const totalCount = paymentType === "one-time" ? 1 : 2;

    const order = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      total_count: totalCount, // 1 for one-time, 2 for recurring
      customer_notify: 1,
      quantity: 1,
    });

    // Calculate expiry date based on plan interval
    const { expiryDate } = calculateSubscriptionDates(plan.interval);
    
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "razorpay.subscriptionId": order.id,
        "subscription.status": null,
        "subscription.gateway": "razorpay",
        "subscription.plan": plan._id,
        "subscription.paymentType": paymentType, // Store the new payment type
        "subscription.auto_pay": paymentType === "recurring", // Enable auto-pay only for recurring
        "subscription.free": false,
        "subscription.autoRenewalCount": 0, // Reset auto-renewal count
        "subscription.purchaseDate": new Date(),
        "subscription.startDate": new Date(),
        "subscription.expire": expiryDate,
      },
    });

    return res.json({ 
      message: "Subscription renewed successfully",
      subscription: order,
      paymentType: paymentType
    });
  } catch (error: any) {
    console.error("Error in manualRenewSubscription:", error);
    return res.status(400).json({ error: error?.message });
  }
};

export const getSubscriptionStatus = async (
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

    return res.json({
      hasSubscription: true,
      subscription: {
        status: user.subscription.status,
        plan: plan,
        expire: user.subscription.expire,
        auto_pay: user.subscription.auto_pay,
        autoRenewalCount: autoRenewalCount,
        canAutoRenew: canAutoRenew,
        needsManualRenewal: needsManualRenewal,
        gateway: user.subscription.gateway,
        paymentType: user.subscription.paymentType || "unknown"
      },
      message: needsManualRenewal 
        ? "Auto-renewal limit reached. Manual renewal required for next billing cycle."
        : user.subscription.paymentType === "one-time"
        ? "One-time payment subscription. Manual renewal required for next billing cycle."
        : "Subscription is active with auto-renewal enabled."
    });
  } catch (error: any) {
    console.error("Error in getSubscriptionStatus:", error);
    return res.status(400).json({ error: error?.message });
  }
};
