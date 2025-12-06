import express from "express";
import { Query, User } from "../models/index.js";
import { sendEmail } from "../utils/email.js";

export const getQueries = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const queries = await Query.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    return res.json(queries);
  } catch (error) {
    console.error("Get Queries Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch queries" });
  }
};

export const sendQuery = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { name, message, email } = req.body;
    if (!email || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Email and Message are required" });
    }

    const user: any = await User.findOne({ email });

    const query = new Query({
      user: user?._id || null,
      name,
      email,
      message,
    });

    await query.save();

    // Send notification email to pilotshala8@gmail.com
    const notificationSubject = "New Query Received - PilotShala";
    const notificationMessage = `
      <h2>New Query Received</h2>
      <p><strong>From:</strong> ${name || 'Anonymous'}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
        ${message}
      </div>
      <p><strong>Received at:</strong> ${new Date().toLocaleString()}</p>
    `;

    // Send notification email (non-blocking)
    sendEmail("support@pilotshala.com", notificationMessage, notificationSubject)
      .then((success) => {
        if (success) {
          console.log("Notification email sent successfully to pilotshala8@gmail.com");
        } else {
          console.error("Failed to send notification email to pilotshala8@gmail.com");
        }
      })
      .catch((error) => {
        console.error("Error sending notification email:", error);
      });

    return res.json({
      success: true,
      message: "Query sent successfully",
      query,
    });
  } catch (error) {
    console.error("Send Query Error:", error);
    res.status(500).json({ success: false, message: "Failed to send query" });
  }
};

export const markQueryAsRead = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const query = await Query.findByIdAndUpdate(
      id,
      { readed: true },
      { new: true }
    );
    if (!query) {
      return res
        .status(404)
        .json({ success: false, message: "Query not found" });
    }
    return res.json({
      success: true,
      message: "Query marked as read",
      query,
    });
  } catch (error) {
    console.error("Mark Query As Read Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark query as read" });
  }
};

export const replyToQuery = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    const query = await Query.findById(id);

    if (!query) {
      return res
        .status(404)
        .json({ success: false, message: "Query not found" });
    }

    if (!reply) {
      return res
        .status(400)
        .json({ success: false, message: "Reply is required" });
    }

    const response = await sendEmail(query.email, reply);

    if (!response) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send reply email" });
    }

    query.reply = reply;
    query.readed = true; // Mark as read when replying
    await query.save();

    if (!query) {
      return res
        .status(404)
        .json({ success: false, message: "Query not found" });
    }

    return res.json({
      success: true,
      message: "Reply sent successfully",
      query,
    });
  } catch (error) {
    console.error("Reply To Query Error:", error);
    res.status(500).json({ success: false, message: "Failed to send reply" });
  }
};

export const deleteQuery = async (
  req: express.Request,
  res: express.Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const query = await Query.findByIdAndDelete(id);
    
    if (!query) {
      return res
        .status(404)
        .json({ success: false, message: "Query not found" });
    }
    
    return res.json({
      success: true,
      message: "Query deleted successfully",
    });
  } catch (error) {
    console.error("Delete Query Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete query" });
  }
};
