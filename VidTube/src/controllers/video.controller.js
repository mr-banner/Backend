import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const createVideo = asyncHandler(async(req,res) => {
    const {title, description} = req.body

    if([title,description].some((field) => field === "")){
        throw new ApiError(400,"All fields are required")
    }

    const videoLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if(!videoLocalPath){
        throw new ApiError(400, "Video is required");
    }

    let videoFile, thumbnail;

    if(videoLocalPath){
        try {
        videoFile = await uploadOnCloudinary(videoLocalPath);
        } catch (error) {
            throw new ApiError(400,"Error uploading video on cloudinary")
        }
    }

    if(thumbnailLocalPath){
        try {
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        } catch (error) {
            console.log("error uploading thumbnail");
            throw new ApiError(400,"Error uploading thumbnail on cloudinary")
        }
    }

    if(!videoFile){
        throw new ApiError(400,"Error uploading video on cloudinary")
    }

    if(!thumbnail){
        throw new ApiError(400,"Error uploading thumbnail on cloudinary")
    }

    try {
        const user = req.user._id;
        const videoUpload = await Video.create({
            videoFile:videoFile?.url,
            thumbnail:thumbnail?.url,
            title,
            description,
            duration:videoFile?.duration,
            isPublished:true,
            owner:user
        })

        const uploadedVideo = await Video.findById(videoUpload._id).populate("owner","username email")

        if(!uploadedVideo){
            throw new ApiError(400,"Error creating video");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, uploadedVideo, "Video uploaded successfully")
        )

    } catch (error) {
        if(videoFile?.public_id){
            await deleteFromCloudinary(videoFile.public_id);
        }
        if(thumbnail?.public_id){
            await deleteFromCloudinary(thumbnail.public_id);
        }

        throw new ApiError(
            500,
            "Something went wrong while creating the video and deleted the video and thumbnail"
        )
    }
})

const deleteVideo = asyncHandler(async(req,res) => {
    const { id }  = req.params

    if(!id){
        throw new ApiError(400,"Video id is required")
    }

    const video = await Video.findById(id);
    
    const oldVideoFile = video?.videoFile
    const oldThumbnail = video?.thumbnail
    let oldVideoPublicId,oldThumbnailPublicId;

    if (oldVideoFile) {
        const parts = oldVideoFile.split("/");
        const fileName = parts.pop();
        const folderPath = parts.slice(7).join("/");
        oldVideoPublicId = `${folderPath}/${fileName.split(".")[0]}`.replace(/^\//, "");
    }

    if (oldThumbnail) {
        const parts = oldThumbnail.split("/");
        const fileName = parts.pop();
        const folderPath = parts.slice(7).join("/");
        oldThumbnailPublicId = `${folderPath}/${fileName.split(".")[0]}`.replace(/^\//, "");
    }
    
    console.log("old video Id", oldVideoPublicId);
    console.log("old video Id", oldThumbnailPublicId);
    try {
        const deletedVideo = await Video.deleteOne({ _id: id })
        if (deletedVideo.deletedCount === 0) {
            return res.status(404).json(new ApiError(404, "video not found"));
        }

        if (oldThumbnailPublicId) {
            const thumbnailResponse = await deleteFromCloudinary(oldThumbnailPublicId, "image");
            console.log("Thumbnail deletion response:", thumbnailResponse);
        }

        if (oldVideoPublicId) {
            const videoResponse = await deleteFromCloudinary(oldVideoPublicId, "video");
            console.log("Video deletion response:", videoResponse);
        }


        return res
                .status(200)
                .json(
                    new ApiResponse(200,deletedVideo,"video deleted from db and cloudinary successfully")
                )
    } catch (error) {
        return res
        .status(500)
        .json(new ApiError(500, "Something went wrong while deleting"));
    }
})


export { createVideo, deleteVideo }
