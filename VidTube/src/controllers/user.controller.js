import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefershToken = async (userId) => {
  const user = await User.findById(userId);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  // Validate required fields
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // File paths from multer
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  let avatar, coverImage;

  // Upload avatar to Cloudinary
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  } catch (error) {
    console.log("Error uploading avatar:", error);
    throw new ApiError(400, "Avatar file upload failed");
  }

  // Upload cover image to Cloudinary
  if (coverImageLocalPath) {
    try {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
    } catch (error) {
      console.log("Error uploading coverImage:", error);
      throw new ApiError(400, "CoverImage file upload failed");
    }
  }

  try {
    // Create the user
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered Successfully"));
  } catch (error) {
    console.log("User creation failed:", error);

    if (avatar?.public_id) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage?.public_id) {
      await deleteFromCloudinary(coverImage.public_id);
    }

    throw new ApiError(
      500,
      "Something went wrong while registering the user and deleted the images"
    );
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  const { _id } = req.body;
  if (!_id) {
    return res.status(400).json(new ApiError(400, "Id is missing"));
  }

  try {
    const response = await User.deleteOne({ _id });

    if (response.deletedCount === 0) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }

    return res
      .status(201)
      .json(new ApiResponse(200, response, "User Deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, "Something went wrong while deleting"));
  }
});

const loginUser = asyncHandler(async (req, res) => {
  // take parameters from req.body
  const { email, password, username } = req.body;
  // check validatation usually email or username or password
  if (!email && !username) {
    res.status(401).json(new ApiError(400, "Email or username is required"));
  }
  // check db with checking of password and email or username field
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    res.status(404).json(new ApiError(404, {}, "User not found"));
  }

  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    res.status(401).json(new ApiError(401, {}, "Invalid credentials"));
  }
  // generate accesstoken and generate refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefershToken(
    user._id
  );

  const loggedUser = await User.findById(user._id).select(
    "-password -refreshToekn"
  );
  // send cookie and response
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        {
          loggedUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefershToken(user._id);

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const getAllUser = asyncHandler(async (req, res) => {
  const users = await User.find();
  return res.status(200).json(new ApiResponse(200, users, "All user fetched"));
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateDetails = asyncHandler(async (req, res) => {
  const { username, fullname, email } = req.body;
  if (!(username || fullname || email)) {
    throw new ApiError(400, "Field is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        username,
        fullname,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  res.status(200).json(new ApiResponse(200, user, "Information Updated"));
});

const updateAvater = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file missing");
    }
  
    const user = req.user;
  
    const oldAvatar = user?.avatar;
    let oldAvatarPublicId;
  
    if (oldAvatar) {
      const parts = oldAvatar.split("/");
      const fileName = parts.pop();
      const folderPath = parts.slice(7).join("/");
      oldAvatarPublicId = `${folderPath}/${fileName.split(".")[0]}`.replace(/^\//, "");
    }
  
    if (oldAvatarPublicId) {
      try {
        const result = await deleteFromCloudinary(oldAvatarPublicId);
      } catch (error) {
        console.error("Error deleting old avatar from Cloudinary:", error);
      }
    }
  
    let avatar;
    try {
      avatar = await uploadOnCloudinary(avatarLocalPath);
    } catch (error) {
      throw new ApiError(500, "Failed to upload avatar");
    }
  
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { avatar: avatar?.url } },
      { new: true }
    ).select("-password");

  
    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Avatar changed successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverLocalPath = req.file?.path;
    if (!coverLocalPath) {
      throw new ApiError(400, "Avatar file missing");
    }
  
    const user = req.user;
  
    const oldCover = user?.coverImage;
    let oldCoverPublicId;
  
    if (oldCover) {
      const parts = oldCover.split("/");
      const fileName = parts.pop();
      const folderPath = parts.slice(7).join("/");
      oldCoverPublicId = `${folderPath}/${fileName.split(".")[0]}`.replace(/^\//, "");
    }
  
    if (oldCoverPublicId) {
      try {
        await deleteFromCloudinary(oldCoverPublicId);
      } catch (error) {
        console.error("Error deleting old avatar from Cloudinary:", error);
      }
    }
  
    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);
    } catch (error) {
      throw new ApiError(500, "Failed to upload avatar");
    }
  
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { coverImage: coverImage?.url || "" } },
      { new: true }
    ).select("-password");

  
    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Cover Image changed successfully"));
});

const getUserChannelProfile = asyncHandler(async (req,res)=>{
  const {username} = req.params

  if(!username){
    throw new ApiError(400, "Username not found");
  }

  const channel = await User.aggregate([
    {
      $match:{
        username:username
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      }
    },
    {
      $addFields:{
        subScribersCount:{
          $size: { $ifNull: ["$subscibers", []] }
        },
        channelSubscribedToCount:{
          $size: { $ifNull: ["$subscibedTo", []] }
        },
        isSubscribed:{
          $cond:{
            if:{$in:[req.user?._id, "$subscribers.subscriber"]},
            then:true,
            else:false
          }
        }
      }
    },
    {
      $project:{
        fullname:1,
        username:1,
        subScribersCount:1,
        channelSubscribedToCount:1,
        isSubscribed:1,
        coverImage:1,
        avatar:1,
        email:1
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404, "channel doesnot exit")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "User channel fetched successfully")
  )
})

const getWatchHistory = asyncHandler(async (req,res)=>{
  const user = await User.aggregate([
    {
      $match:{
        _id:new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullname:1,
                    username:1,
                    avatar:1,
                  }
                }
              ]
            }
          }
        ]
      }
    },
    {
      $addFields:{
        owner:{
          $first:"$owner"
        }
      }
    }
  ])

  if(!user){
    throw new ApiError(400,"watch history not found");
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, user[0].watchHistory,"Watch history fetched successfully")
  )
})
  
  

export {
  registerUser,
  deleteUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getAllUser,
  changePassword,
  getCurrentUser,
  updateDetails,
  updateAvater,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
