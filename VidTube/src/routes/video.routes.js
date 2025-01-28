import { Router } from "express";
import { createVideo, deleteVideo } from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verfiyJWT } from "../middlewares/auth.middleware.js";

const router = Router()
router.use(verfiyJWT);
router.route("/create").post(
    upload.fields([
        {
            name:"videoFile",
            maxCount:1,
        },
        {
            name:"thumbnail",
            maxCount:1,
        }
    ]),
    createVideo
)

router.route("/delete/:id").delete(deleteVideo)

export default router;
