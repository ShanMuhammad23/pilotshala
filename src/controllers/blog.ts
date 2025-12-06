import { Request, Response } from "express";
import { Blog } from "../models/index.js";

export const createBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const { blogId, ...formData } = req.body;
    if (!formData.title || !formData.content) {
      return res
        .status(400)
        .json({ success: false, message: "Title and content are required" });
    }

    console.log("=== CREATE BLOG DEBUG ===");
    console.log("Original formData:", {
      scheduledAt: formData.scheduledAt,
      isScheduled: formData.isScheduled,
      isPublished: formData.isPublished
    });

    // Handle scheduling logic
    if (formData.scheduledAt && formData.scheduledAt !== null && formData.scheduledAt !== "" && formData.scheduledAt !== "null") {
      let scheduledDate: Date;
      
      try {
        scheduledDate = new Date(formData.scheduledAt);
        
        // Check if the date is valid
        if (isNaN(scheduledDate.getTime())) {
          console.log("Invalid date format:", formData.scheduledAt);
          return res
            .status(400)
            .json({ success: false, message: "Invalid scheduled date format" });
        }
        
        const now = new Date();
        
        if (scheduledDate <= now) {
          console.log("Date is in the past:", scheduledDate, "<= ", now);
          return res
            .status(400)
            .json({ success: false, message: "Scheduled date must be in the future" });
        }
        
        // If scheduled, ensure isPublished is false and isScheduled is true
        formData.isPublished = false;
        formData.publishedAt = null;
        formData.isScheduled = true;
        formData.scheduledAt = scheduledDate.toISOString(); // Ensure consistent format
        
        console.log("Scheduling blog for:", scheduledDate.toISOString());
      } catch (error) {
        console.log("Error parsing date:", error);
        return res
          .status(400)
          .json({ success: false, message: "Invalid scheduled date" });
      }
    } else if (formData.isPublished) {
      // If publishing immediately, clear any scheduled date
      formData.scheduledAt = null;
      formData.publishedAt = new Date();
      formData.isScheduled = false;
      console.log("Publishing immediately");
    } else {
      // If draft, clear both scheduled and published dates
      formData.scheduledAt = null;
      formData.publishedAt = null;
      formData.isScheduled = false;
      console.log("Saving as draft");
    }

    console.log("Processed formData:", {
      scheduledAt: formData.scheduledAt,
      isScheduled: formData.isScheduled,
      isPublished: formData.isPublished
    });

    let blog = null;
    if (blogId) {
      blog = await Blog.findByIdAndUpdate(blogId, formData, {
        new: true,
        runValidators: true,
      });

      if (blog && blog.isPublished && !blog.publishedAt) {
        blog.publishedAt = new Date();
        await blog.save();
      }
    } else {
      let slug = formData?.title
        ?.toLowerCase()
        ?.replace(/[^a-z0-9 ]+/g, "") // remove non-alphanumeric except space
        ?.replace(/\s+/g, " ") // replace multiple spaces with one
        ?.trim() // trim leading/trailing spaces
        ?.replace(/ /g, "-");
      // Ensure slug is unique
      let index = 1;
      while (true) {
        const existingBlog = await Blog.findOne({ slug });
        if (!existingBlog) {
          break;
        } else {
          slug = `${slug}-${index}`;
          index = index + 1;
        }
      }
      blog = await Blog.create({ ...formData, author: req.user?._id, slug });
    }

    // Ensure the response includes the correct isScheduled and scheduledAt values
    const responseBlog = await Blog.findById(blog?._id)
      .populate("author", "name email")
      .populate("category", "name");

    console.log("Final response:", {
      scheduledAt: responseBlog?.scheduledAt,
      isScheduled: responseBlog?.isScheduled,
      isPublished: responseBlog?.isPublished
    });
    console.log("=== END CREATE BLOG DEBUG ===");

    // Ensure all fields are included in the response
    const blogObject = responseBlog?.toObject();
    const finalResponse = {
      ...blogObject,
      isScheduled: blogObject?.isScheduled ?? false,
      scheduledAt: blogObject?.scheduledAt ?? null
    };

    console.log("Final response object:", {
      isScheduled: finalResponse.isScheduled,
      scheduledAt: finalResponse.scheduledAt
    });

    return res.json(finalResponse);
  } catch (error) {
    console.error("Get Blog Error:", error);
    res.status(500).json({ success: false, message: "Failed to save blog" });
  }
};

export const updateBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const data = req.body;

    console.log("=== UPDATE BLOG DEBUG ===");
    console.log("Original data:", {
      scheduledAt: data.scheduledAt,
      isScheduled: data.isScheduled,
      isPublished: data.isPublished
    });

    // Handle scheduling logic
    if (data.scheduledAt && data.scheduledAt !== null && data.scheduledAt !== "" && data.scheduledAt !== "null") {
      let scheduledDate: Date;
      
      try {
        scheduledDate = new Date(data.scheduledAt);
        
        // Check if the date is valid
        if (isNaN(scheduledDate.getTime())) {
          console.log("Invalid date format:", data.scheduledAt);
          return res
            .status(400)
            .json({ success: false, message: "Invalid scheduled date format" });
        }
        
        const now = new Date();
        
        if (scheduledDate <= now) {
          console.log("Date is in the past:", scheduledDate, "<= ", now);
          return res
            .status(400)
            .json({ success: false, message: "Scheduled date must be in the future" });
        }
        
        // If scheduled, ensure isPublished is false and isScheduled is true
        data.isPublished = false;
        data.publishedAt = null;
        data.isScheduled = true;
        data.scheduledAt = scheduledDate.toISOString(); // Ensure consistent format
        
        console.log("Scheduling blog for:", scheduledDate.toISOString());
      } catch (error) {
        console.log("Error parsing date:", error);
        return res
          .status(400)
          .json({ success: false, message: "Invalid scheduled date" });
      }
    } else if (data.isPublished) {
      // If publishing immediately, clear any scheduled date
      data.scheduledAt = null;
      data.publishedAt = new Date();
      data.isScheduled = false;
      console.log("Publishing immediately");
    } else {
      // If draft, clear both scheduled and published dates
      data.scheduledAt = null;
      data.publishedAt = null;
      data.isScheduled = false;
      console.log("Saving as draft");
    }

    console.log("Processed data:", {
      scheduledAt: data.scheduledAt,
      isScheduled: data.isScheduled,
      isPublished: data.isPublished
    });

    const blog = await Blog.findByIdAndUpdate(
      id,
      { ...data },
      { new: true, runValidators: true }
    );

    if (blog?.isPublished && !blog.publishedAt) {
      blog.publishedAt = new Date();
      await blog.save();
    }

    // Ensure the response includes the correct isScheduled and scheduledAt values
    const responseBlog = await Blog.findById(id)
      .populate("author", "name email")
      .populate("category", "name");

    console.log("Final response:", {
      scheduledAt: responseBlog?.scheduledAt,
      isScheduled: responseBlog?.isScheduled,
      isPublished: responseBlog?.isPublished
    });
    console.log("=== END UPDATE BLOG DEBUG ===");

    // Ensure all fields are included in the response
    const blogObject = responseBlog?.toObject();
    const finalResponse = {
      ...blogObject,
      isScheduled: blogObject?.isScheduled ?? false,
      scheduledAt: blogObject?.scheduledAt ?? null
    };

    console.log("Final response object:", {
      isScheduled: finalResponse.isScheduled,
      scheduledAt: finalResponse.scheduledAt
    });

    return res.json(finalResponse);
  } catch (error) {
    console.error("Update Blog Error:", error);
    res.status(500).json({ success: false, message: "Failed to update blog" });
  }
};

export const getAllBlogs = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { isPublic } = req.query;
    const blogs = await Blog.find({
      ...(isPublic ? { isPublished: true } : {}),
    })
      .populate("author", "name email")
      .populate("category", "name")
      .sort({ createdAt: -1 });

    return res.json(blogs);
  } catch (error) {
    console.error("Get All Blogs Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch blogs" });
  }
};

export const getPublishedBlogs = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const now = new Date();
    
    // Get published blogs and scheduled blogs that have reached their scheduled time
    const blogs = await Blog.find({
      $or: [
        { isPublished: true },
        {
          isPublished: false,
          scheduledAt: { $lte: now, $ne: null }
        }
      ]
    })
      .populate("author", "name email")
      .populate("category", "name")
      .sort({ createdAt: -1 });
    
    return res.json(blogs);
  } catch (error) {
    console.error("Get All Blogs Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch blogs" });
  }
};

export const getBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id)
      .populate("author", "name email")
      .populate("category", "name")
      .populate("comments.user", "name email");

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    return res.json(blog);
  } catch (error) {
    console.error("Get Blog Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch blog" });
  }
};

export const getPublicBlog = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { slug } = req.params;
    const now = new Date();
    
    // Query for published or scheduled blogs that have reached their scheduled time
    let blog = await Blog.findOne({
      slug,
      $or: [
        { isPublished: true },
        {
          isPublished: false,
          scheduledAt: { $lte: now, $ne: null }
        }
      ]
    })
      .populate("author", "name email")
      .populate("category", "name")
      .populate("comments.user", "name email");

    if (!blog) {
      blog = await Blog.findOne({
        _id: slug,
        $or: [
          { isPublished: true },
          {
            isPublished: false,
            scheduledAt: { $lte: now, $ne: null }
          }
        ]
      })
        .populate("author", "name email")
        .populate("category", "name")
        .populate("comments.user", "name email");
    }

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }
    blog.views = (blog?.views || 0) + 1;
    await blog.save();

    return res.json(blog);
  } catch (error) {
    console.error("Get Blog Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch blog" });
  }
};

export const deleteBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }
    return res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete Blog Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete blog" });
  }
};

export const markBlogAsFeatured = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    await Blog.updateMany({ isFeatured: true }, { isFeatured: false });
    const blog = await Blog.findByIdAndUpdate(
      id,
      { isFeatured: true },
      { new: true, runValidators: true }
    );
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }
    return res.json({
      success: true,
      message: "Blog marked as featured",
      blog,
    });
  } catch (error) {
    console.error("Mark Blog as Featured Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark blog as featured" });
  }
};

// Function to automatically publish scheduled blogs
export const publishScheduledBlogs = async (): Promise<void> => {
  try {
    const now = new Date();
    
    // Find all scheduled blogs that have reached their scheduled time
    const scheduledBlogs = await Blog.find({
      isPublished: false,
      isScheduled: true,
      scheduledAt: { $lte: now, $ne: null }
    });

    // Update each scheduled blog to published status
    for (const blog of scheduledBlogs) {
      await Blog.findByIdAndUpdate(blog._id, {
        isPublished: true,
        publishedAt: new Date(),
        scheduledAt: null,
        isScheduled: false
      });
    }

    if (scheduledBlogs.length > 0) {
      console.log(`Published ${scheduledBlogs.length} scheduled blog(s)`);
    }
  } catch (error) {
    console.error("Error publishing scheduled blogs:", error);
  }
};
