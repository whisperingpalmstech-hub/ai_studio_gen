
import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { COMFYUI_INPUT_DIR } from "../config/comfy-paths.js";
import { BadRequestError } from "../middleware/error.js";

const router = Router();

// Configure Multer for local storage directly into ComfyUI input folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(COMFYUI_INPUT_DIR)) {
            fs.mkdirSync(COMFYUI_INPUT_DIR, { recursive: true });
        }
        cb(null, COMFYUI_INPUT_DIR);
    },
    filename: (req, file, cb) => {
        // Enterprise: Use UUID for the filename to prevent any collisions
        const ext = path.extname(file.originalname) || ".png";
        const jobId = req.body.jobId || uuidv4();
        const filename = `${jobId}${ext}`;
        cb(null, filename);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG and WEBP are allowed."));
        }
    },
});

// POST /api/v1/uploads/image
router.post("/image", upload.single("image"), (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
        throw new BadRequestError("No image file uploaded.");
    }

    console.log(`💾 Enterprise Upload: Received ${req.file.filename} (${req.file.size} bytes)`);
    console.log(`📍 Saved to: ${req.file.path}`);

    res.json({
        success: true,
        filename: req.file.filename,
        path: req.file.path,
    });
});

export { router as uploadsRouter };
