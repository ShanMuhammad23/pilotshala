import dotenv from "dotenv";
import express from "express";
import { Resend } from "resend";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "support@pilotshala.com";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  try {
    if (!resend) {
      console.error("Resend client not configured. Missing RESEND_API_KEY.");
      return false;
    }

    if (!RESEND_FROM) {
      console.error("Missing RESEND_FROM. Set to a verified sender address (e.g., no-reply@yourdomain.com)");
      return false;
    }

    console.log("[Resend] Sending email:", { to, subject, from: RESEND_FROM });
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Resend] Error: ", error);
      return false;
    }

    console.log("[Resend] Email queued successfully", data);
    return true;
  } catch (error: any) {
    console.error("[Resend] Exception:", error?.message || error);
    return false;
  }
}

export const sendEmail = async (
  email: string,
  message: string,
  subject: string = "PilotShala Customer Support"
) => {
  return await sendViaResend(email, subject, message);
};

export const sendEmailEndpoint = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { email, subject, body } = req.body;
    const ok = await sendViaResend(email, subject, body);
    if (ok) return res.json({ message: "Email sent successfully" });
    return res.status(500).json({ message: "Failed to send email" });
  } catch (error) {
    console.error("Error in sendEmailEndpoint:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendQueryEmail = async (
  email: string,
  name: string,
  message: string
) => {
  const html = `
    <div>
      <p>New Query on PilotShala</p>
      <hr/>
      <p>${message}</p>
      <hr/>
      <p>${name} | ${email}</p>
    </div>
  `;
  return await sendViaResend("support@pilotshala.com", `Query from ${email}`, html);
};

export const sendWelcomeEmail = async (email: string, name: string) => {
  const welcomeMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin-bottom: 10px;">Welcome to Pilot Shala!</h1>
          <p style="color: #7f8c8d; font-size: 18px; margin: 0;">Your journey to becoming a commercial pilot starts here</p>
        </div>
        <div style="margin-bottom: 30px;">
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">We're excited to welcome you aboard!</p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">You've just taken the first step toward becoming a commercial pilot, and we're excited to be a part of your journey.</p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">Your dashboard is now live, start exploring lessons, practice questions, and more to boost your exam prep.</p>
        </div>
        <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #2c3e50; margin-top: 0; margin-bottom: 15px;">Need any help?</h3>
          <p style="color: #2c3e50; font-size: 14px; line-height: 1.5; margin-bottom: 10px;">You can simply reply to this email or raise a support ticket on Pilot Shala. Our team will get in touch with you as soon as possible.</p>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 5px;">
            <h4 style="color: #2c3e50; margin-top: 0; margin-bottom: 10px;">Support Timings:</h4>
            <ul style="color: #2c3e50; font-size: 14px; line-height: 1.5; margin: 0; padding-left: 20px;">
              <li><strong>10 AM to 10 PM</strong> – You'll get a reply within 1–2 hours</li>
              <li><strong>10 PM to 10 AM</strong> – Response time may take 6–8 hours</li>
            </ul>
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">We're here to help you every step of the way.</p>
          <p style="color: #2c3e50; font-size: 18px; font-weight: bold;">Let's get you flying high!</p>
        </div>
        <div style="border-top: 1px solid #ecf0f1; padding-top: 20px; text-align: center;">
          <p style="color: #7f8c8d; font-size: 14px; margin: 0;">
            <strong>Sonali</strong><br/>
            Team Pilot Shala
          </p>
        </div>
      </div>
    </div>
  `;
  return await sendViaResend(email, "Welcome to Pilot Shala - Your Journey Begins!", welcomeMessage);
};

export const sendPasswordResetEmail = async (email: string, otp: string) => {
  const resetMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin-bottom: 10px;">Password Reset Request</h1>
          <p style="color: #7f8c8d; font-size: 18px; margin: 0;">You requested to reset your Pilot Shala password</p>
        </div>
        <div style="margin-bottom: 30px;">
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">Hi there,</p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your Pilot Shala account. If you didn't make this request, you can safely ignore this email.</p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">To reset your password, use the following OTP code:</p>
        </div>
        <div style="background-color: #ecf0f1; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
          <h2 style="color: #2c3e50; margin-top: 0; margin-bottom: 20px;">Your OTP Code</h2>
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; display: inline-block;">
            <span style="font-size: 36px; font-weight: bold; color: #3498db; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #7f8c8d; font-size: 14px; margin-top: 15px; margin-bottom: 0;">This code will expire in 10 minutes</p>
        </div>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0; margin-bottom: 15px;">⚠️ Important Security Notice</h3>
          <ul style="color: #856404; font-size: 14px; line-height: 1.5; margin: 0; padding-left: 20px;">
            <li>Never share this OTP with anyone</li>
            <li>Pilot Shala staff will never ask for your OTP</li>
            <li>If you didn't request this reset, please contact support immediately</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        </div>
        <div style="border-top: 1px solid #ecf0f1; padding-top: 20px; text-align: center;">
          <p style="color: #7f8c8d; font-size: 14px; margin: 0;">
            <strong>Pilot Shala Support Team</strong><br/>
            We're here to help you soar higher!
          </p>
        </div>
      </div>
    </div>
  `;
  return await sendViaResend(email, "Reset Your Pilot Shala Password - OTP Code", resetMessage);
};

export const sendConfirmationEmail = async (email: string, code: string) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Welcome to PilotShala!</h2>
      <p>Please confirm your email by using the code:</p>
      <p style="font-size: 32px; font-weight: bold; color: #3498db; text-align: center;">${code}</p>
    </div>
  `;
  return await sendViaResend(email, "Confirm Email", html);
};
