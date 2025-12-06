// checkBlogSchema.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Blog } from '../models/index.js'; // Fixed import path

dotenv.config();

const uri = process.env.MONGO_URI;

(async () => {
  try {
    await mongoose.connect(uri + "/main");
    console.log('Connected to DB');

    // 1️⃣ Check schema fields
    const schemaKeys = Object.keys(Blog.schema.paths);
    console.log('Schema keys:', schemaKeys);

    if (!schemaKeys.includes('isScheduled') || !schemaKeys.includes('scheduledAt')) {
      console.log('❌ Missing fields in schema — production is not using latest model file.');
    } else {
      console.log('✅ Fields exist in schema');
    }

    // 2️⃣ Test defaults without saving
    const tempBlog = new Blog({ title: 'Temp Test Blog' }); // no isScheduled or scheduledAt provided
    console.log('Temp Blog in memory:', tempBlog.toObject());

    // 3️⃣ Check existing blogs in database
    const existingBlogs = await Blog.find({}).limit(3);
    console.log('Existing blogs sample:', existingBlogs.map(blog => ({
      _id: blog._id,
      title: blog.title,
      isScheduled: blog.isScheduled,
      scheduledAt: blog.scheduledAt,
      isPublished: blog.isPublished
    })));

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error(err);
  }
})();
