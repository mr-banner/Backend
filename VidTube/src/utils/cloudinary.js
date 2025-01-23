import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises"; // Use promises-based file system operations
import dotenv from "dotenv";

dotenv.config();

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a file to Cloudinary
const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) {
        console.error("No local file path provided for upload.");
        return null;
    }

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto", // Automatically detect resource type
        });
        // console.log("File uploaded to Cloudinary:", response.url);

        // Remove local file after successful upload
        await fs.unlink(localFilePath);
        return response;
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        // Ensure local file is deleted even if upload fails
        try {
            await fs.unlink(localFilePath);
        } catch (unlinkError) {
            console.error("Error deleting local file after failed upload:", unlinkError);
        }

        return null;
    }
};

// Delete a file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    if (!publicId) {
        console.error("No public ID provided for deletion.");
        return null;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from Cloudinary:", publicId);
        return result;
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };
