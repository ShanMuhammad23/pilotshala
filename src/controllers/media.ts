import { Request, Response } from "express";
import { Media } from "../models/index.js";
import ImageKit from "imagekit";
import fs from "fs";
import sharp from "sharp";

// ImageKit setup
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export const uploadImage = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    const fileData = fs.readFileSync(file?.path);

    // Compress the image using sharp before upload
    const compressedBuffer = await sharp(fileData)
      .webp({ quality: 80 })
      .toBuffer();

    const uploadResponse = await imagekit.upload({
      file: compressedBuffer,
      fileName: file.originalname,
    });

    const result = await Media.create({
      name: file.originalname,
      url: uploadResponse.url,
      size: uploadResponse.size,
      type: "image",
      imageKitId: uploadResponse.fileId,
    });

    fs.unlinkSync(file.path);

    return res.json(result);
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

export const getImages = async (req: Request, res: Response): Promise<any> => {
  try {
    const images = await Media.find({ type: "image" });
    return res.json(images);
  } catch (error) {
    console.error("Get Images Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch images" });
  }
};

export const deleteImage = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const media = await Media.findById(id);
    if (!media) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    if (!media.imageKitId) {
      return res
        .status(400)
        .json({ success: false, message: "ImageKit ID not found" });
    }
    await imagekit.deleteFile(media.imageKitId);
    await Media.findByIdAndDelete(id);

    return res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Delete Image Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete image" });
  }
};
