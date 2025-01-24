import { Router } from "express";
import {
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
  getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verfiyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/delete").delete(deleteUser);
router.route("/login").post(loginUser);

//secured routes
router.route("/logout").post(verfiyJWT, logoutUser);
router.route("refresh-token").post(refreshAccessToken);
router.route("/getAll").get(getAllUser);
router.route("/change-password").post(verfiyJWT,changePassword)
router.route("/currentUser").get(verfiyJWT,getCurrentUser)
router.route("/update").patch(verfiyJWT,updateDetails)
router.route("/update-avatar").patch(verfiyJWT,upload.single("avatar"),updateAvater)
router.route("/update-cover").patch(verfiyJWT,upload.single("coverImage"),updateCoverImage)
router.route("/channel/:username").get(verfiyJWT,getUserChannelProfile)
router.route("/history").get(verfiyJWT,getWatchHistory)

export default router;
