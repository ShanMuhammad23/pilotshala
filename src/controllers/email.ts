import express from "express";
import { User } from "../models/index.js";
import { sendEmail } from "../utils/email.js";

export const sendExpiryReminderEmail = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  console.log("sendExpiryReminderEmail called with body:", req.body);
  
  try {
    const { userId, email, name, expiryDate, daysUntilExpiry } = req.body;

    // Validate required fields
    if (!userId || !email || !name || !expiryDate) {
      return res.status(400).json({ 
        error: "Missing required fields: userId, email, name, expiryDate" 
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Format the expiry date
    const formattedExpiryDate = new Date(expiryDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create email content based on days until expiry
    let subject = "";
    let emailContent = "";

    if (daysUntilExpiry < 0) {
      subject = "Your PilotShala subscription has expired";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Subscription Expired</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription has expired on <strong>${formattedExpiryDate}</strong>.</p>
          <p>To continue accessing our premium content and practice tests, please renew your subscription.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Why renew?</h3>
            <ul>
              <li>Access to comprehensive practice tests</li>
              <li>Detailed performance analytics</li>
              <li>Expert guidance and study materials</li>
              <li>Stay updated with latest aviation knowledge</li>
            </ul>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    } else if (daysUntilExpiry === 0) {
      subject = "Your PilotShala subscription expires today";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Subscription Expires Today</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription expires <strong>today</strong> (${formattedExpiryDate}).</p>
          <p>Don't lose access to your study progress and practice tests. Renew now to continue your aviation journey.</p>
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">⚠️ Last Day Reminder</h3>
            <p style="margin-bottom: 0;">Your access will be restricted after today. Renew now to maintain uninterrupted access.</p>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now - Expires Today</a></p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    } else if (daysUntilExpiry === 1) {
      subject = "Your PilotShala subscription expires tomorrow";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Subscription Expires Tomorrow</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription expires <strong>tomorrow</strong> (${formattedExpiryDate}).</p>
          <p>Don't let your study momentum break. Renew now to continue accessing our premium content.</p>
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">⚠️ Final Reminder</h3>
            <p style="margin-bottom: 0;">Only 1 day left to renew your subscription and maintain uninterrupted access.</p>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now - Expires Tomorrow</a></p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    } else if (daysUntilExpiry <= 3) {
      subject = `Your PilotShala subscription expires in ${daysUntilExpiry} days`;
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Subscription Expires Soon</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription expires in <strong>${daysUntilExpiry} days</strong> (${formattedExpiryDate}).</p>
          <p>Don't lose access to your study progress. Renew now to continue your aviation journey without interruption.</p>
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">⚠️ Urgent Reminder</h3>
            <p style="margin-bottom: 0;">Only ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''} left to renew your subscription.</p>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    } else if (daysUntilExpiry <= 7) {
      subject = `Your PilotShala subscription expires in ${daysUntilExpiry} days`;
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Subscription Expires Soon</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription expires in <strong>${daysUntilExpiry} days</strong> (${formattedExpiryDate}).</p>
          <p>Renew now to ensure uninterrupted access to our comprehensive study materials and practice tests.</p>
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">What you'll continue to access:</h3>
            <ul>
              <li>Comprehensive practice tests</li>
              <li>Performance analytics and insights</li>
              <li>Study materials and guides</li>
              <li>Progress tracking</li>
            </ul>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    } else {
      subject = `Your PilotShala subscription expires in ${daysUntilExpiry} days`;
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Subscription Renewal Reminder</h2>
          <p>Dear ${name},</p>
          <p>Your PilotShala subscription expires in <strong>${daysUntilExpiry} days</strong> (${formattedExpiryDate}).</p>
          <p>Plan ahead and renew your subscription to maintain uninterrupted access to our premium aviation study resources.</p>
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #065f46;">Why renew early?</h3>
            <ul>
              <li>No interruption to your study routine</li>
              <li>Maintain your progress and analytics</li>
              <li>Access to all premium features</li>
              <li>Peace of mind knowing your access is secure</li>
            </ul>
          </div>
          <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
          <p>Best regards,<br>The PilotShala Team</p>
        </div>
      `;
    }

    // Send the email
    console.log(`Attempting to send email to ${email} with subject: ${subject}`);
    console.log(`Email content length: ${emailContent.length} characters`);
    
    try {
      const emailResult = await sendEmail(email, emailContent, subject);
      
      if (!emailResult) {
        throw new Error("Email service returned false - email not sent");
      }
      
      console.log(`Email sent successfully to ${email}`);
    } catch (emailError: any) {
      console.error(`Email sending error for ${email}:`, emailError);
      throw new Error(`Email service error: ${emailError.message}`);
    }

    // Log the email sent (optional - you might want to store this in a database)
    console.log(`Expiry reminder email sent to ${email} for user ${userId}`);

    return res.status(200).json({ 
      success: true, 
      message: `Expiry reminder email sent successfully to ${email}`,
      user: {
        id: userId,
        email: email,
        name: name,
        daysUntilExpiry: daysUntilExpiry
      }
    });

  } catch (error: any) {
    console.error("Error sending expiry reminder email:", error);
    
    // Ensure we always send a response
    try {
      return res.status(500).json({ 
        success: false,
        error: "Failed to send expiry reminder email",
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } catch (jsonError) {
      console.error("Failed to send JSON response:", jsonError);
      return res.status(500).send("Internal Server Error");
    }
  }
};

export const sendBulkExpiryReminderEmails = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        error: "userIds array is required and must not be empty" 
      });
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        // Get user details
        const user = await User.findById(userId).populate("subscription.plan");
        
        if (!user) {
          errors.push({ userId, error: "User not found" });
          continue;
        }

        if (!user.subscription?.expire) {
          errors.push({ userId, error: "No expiry date found" });
          continue;
        }

        const daysUntilExpiry = Math.ceil(
          (new Date(user.subscription.expire).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send email using the same logic as single email
        const formattedExpiryDate = new Date(user.subscription.expire).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        let subject = "";
        let emailContent = "";

        if (daysUntilExpiry < 0) {
          subject = "Your PilotShala subscription has expired";
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Subscription Expired</h2>
              <p>Dear ${user.name},</p>
              <p>Your PilotShala subscription has expired on <strong>${formattedExpiryDate}</strong>.</p>
              <p>To continue accessing our premium content and practice tests, please renew your subscription.</p>
              <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
              <p>Best regards,<br>The PilotShala Team</p>
            </div>
          `;
        } else {
          subject = `Your PilotShala subscription expires in ${daysUntilExpiry} days`;
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Subscription Renewal Reminder</h2>
              <p>Dear ${user.name},</p>
              <p>Your PilotShala subscription expires in <strong>${daysUntilExpiry} days</strong> (${formattedExpiryDate}).</p>
              <p>Renew now to maintain uninterrupted access to our premium aviation study resources.</p>
              <p><a href="${process.env.FRONTEND_URL || 'https://pilotshala.com'}/plans" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a></p>
              <p>Best regards,<br>The PilotShala Team</p>
            </div>
          `;
        }

        const emailResult = await sendEmail(user.email, emailContent, subject);
        
        if (!emailResult) {
          throw new Error("Email service failed to send the email");
        }

        results.push({
          userId: user._id,
          email: user.email,
          name: user.name,
          success: true
        });

        // Add a 1-second delay to avoid overwhelming the email service and prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        errors.push({ 
          userId, 
          error: error.message || "Failed to send email" 
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk email operation completed. ${results.length} emails sent successfully, ${errors.length} failed.`,
      results: {
        successful: results,
        failed: errors
      },
      summary: {
        total: userIds.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error: any) {
    console.error("Error sending bulk expiry reminder emails:", error);
    return res.status(500).json({ 
      error: "Failed to send bulk expiry reminder emails",
      details: error.message 
    });
  }
}; 

export const sendBulkCustomEmails = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { subject, content, recipients } = req.body;

    // Validate required fields
    if (!subject || !content || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Subject, content, and recipients array are required"
      });
    }

    // Validate each recipient has required fields
    for (const recipient of recipients) {
      if (!recipient.email || !recipient.name || !recipient.id) {
        return res.status(400).json({
          success: false,
          message: "Each recipient must have id, name, and email"
        });
      }
    }

    console.log(`Starting bulk email send to ${recipients.length} recipients`);
    console.log(`Subject: ${subject}`);
    console.log(`Content length: ${content.length} characters`);

    const results: Array<{
      id: string;
      name: string;
      email: string;
      success: boolean;
      error?: string;
    }> = [];
    const failedEmails: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    // Process emails in batches to avoid overwhelming the email service
    const batchSize = 10;
    const batches: Array<Array<{
      id: string;
      name: string;
      email: string;
    }>> = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} recipients`);

      // Process emails sequentially within each batch with 1-second delays
      for (let i = 0; i < batch.length; i++) {
        const recipient = batch[i];
        try {
          // Personalize content for each recipient
          const personalizedContent = content.replace(/\{name\}/g, recipient.name);
          
          const emailResult = await sendEmail(recipient.email, personalizedContent, subject);
          
          if (emailResult) {
            sentCount++;
            results.push({
              id: recipient.id,
              name: recipient.name,
              email: recipient.email,
              success: true
            });
            console.log(`✅ Email sent successfully to ${recipient.email}`);
          } else {
            failedCount++;
            failedEmails.push(recipient.email);
            results.push({
              id: recipient.id,
              name: recipient.name,
              email: recipient.email,
              success: false,
              error: "Email service failed"
            });
            console.log(`❌ Email failed to send to ${recipient.email}`);
          }
        } catch (error: any) {
          failedCount++;
          failedEmails.push(recipient.email);
          results.push({
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            success: false,
            error: error.message || "Unknown error"
          });
          console.log(`❌ Error sending email to ${recipient.email}:`, error.message);
        }

        // Add 1-second delay between each email to prevent rate limiting
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Add additional delay between batches for extra safety
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }

    console.log(`Bulk email operation completed. ${sentCount} sent, ${failedCount} failed`);

    return res.status(200).json({
      success: true,
      message: `Bulk email operation completed. ${sentCount} emails sent successfully, ${failedCount} failed.`,
      sentCount,
      failedCount,
      failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
      summary: {
        total: recipients.length,
        successful: sentCount,
        failed: failedCount
      },
      results
    });

  } catch (error: any) {
    console.error("Error sending bulk custom emails:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send bulk emails",
      error: error.message
    });
  }
}; 