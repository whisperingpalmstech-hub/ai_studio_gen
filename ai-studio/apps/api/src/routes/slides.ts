/**
 * Slide Generation Routes
 * POST /api/v1/slides/generate — Generate a PowerPoint presentation from a topic
 * GET  /api/v1/slides/:jobId   — Download a previously generated presentation
 */
import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { generateSlides } from "../services/slide-generator.js";
import { supabaseAdmin } from "../services/supabase.js";
import fs from "fs";
import path from "path";

const router = Router();

// Output directory (shared with slide-generator service)
const OUTPUT_DIR = path.resolve("slide_outputs");

// Validation schema
const generateSlidesSchema = z.object({
    topic: z.string().min(3, "Topic must be at least 3 characters").max(500),
    num_slides: z.number().min(3).max(15).optional().default(6),
    style: z.enum(["corporate", "creative", "minimal", "dark"]).optional().default("corporate"),
});

/**
 * POST /api/v1/slides/generate
 * Generate a complete PowerPoint presentation from a topic
 */
router.post(
    "/generate",
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user!;

            // Validate input
            let validated;
            try {
                validated = generateSlidesSchema.parse(req.body);
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({
                        error: "Validation Error",
                        details: error.errors.map((e: any) => e.message),
                    });
                }
                throw error;
            }

            console.log(`📊 Slide Generation Request from user ${user.id}: "${validated.topic}"`);

            // Check credits (slide generation costs 5 credits)
            const SLIDE_CREDIT_COST = 5;
            if (user.credits < SLIDE_CREDIT_COST) {
                return res.status(402).json({
                    error: "Insufficient Credits",
                    message: `Slide generation requires ${SLIDE_CREDIT_COST} credits. You have ${user.credits}.`,
                });
            }

            // Deduct credits
            await (supabaseAdmin.from("profiles") as any)
                .update({ credits: user.credits - SLIDE_CREDIT_COST })
                .eq("id", user.id);

            // Generate slides (this is the main pipeline)
            // user_id is needed so the service can create image jobs in Supabase
            // → local worker picks them up → ComfyUI generates → uploads to Storage
            const result = await generateSlides({
                topic: validated.topic,
                num_slides: validated.num_slides,
                style: validated.style,
                user_id: user.id,
            });

            // Read the file to send as response
            const fileBuffer = fs.readFileSync(result.filePath);
            const filename = `${validated.topic.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50)}_slides.pptx`;

            // Set headers for file download
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", fileBuffer.length.toString());
            res.setHeader("X-Slide-Job-Id", result.jobId);
            res.setHeader("X-Slides-Count", result.presentation.slides.length.toString());
            res.setHeader("X-Presentation-Title", result.presentation.title);

            return res.send(fileBuffer);
        } catch (error: any) {
            console.error("❌ Slide generation error:", error.message);
            return res.status(500).json({
                error: "Slide Generation Failed",
                message: error.message,
            });
        }
    }
);

/**
 * POST /api/v1/slides/generate-json
 * Generate slide content JSON only (no images, no PPT) — fast preview
 */
router.post(
    "/generate-json",
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user!;

            let validated;
            try {
                validated = generateSlidesSchema.parse(req.body);
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({
                        error: "Validation Error",
                        details: error.errors.map((e: any) => e.message),
                    });
                }
                throw error;
            }

            console.log(`📋 Slide JSON Request from user ${user.id}: "${validated.topic}"`);

            // This is cheaper — only LLM call, no image generation
            const { generateSlideContent } = await import("../services/slide-generator.js");
            const presentation = await generateSlideContent(
                validated.topic,
                validated.num_slides,
                validated.style,
            );

            return res.json({
                success: true,
                presentation,
            });
        } catch (error: any) {
            console.error("❌ Slide JSON error:", error.message);
            return res.status(500).json({
                error: "Slide Content Generation Failed",
                message: error.message,
            });
        }
    }
);

/**
 * GET /api/v1/slides/:jobId
 * Download a previously generated presentation
 */
router.get(
    "/:jobId",
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { jobId } = req.params;
            const outputDir = OUTPUT_DIR;

            // Find matching file
            const files = fs.readdirSync(outputDir).filter((f) => f.includes(jobId) && f.endsWith(".pptx"));

            if (files.length === 0) {
                return res.status(404).json({
                    error: "Not Found",
                    message: `No presentation found for job ID: ${jobId}`,
                });
            }

            const filePath = path.join(outputDir, files[0]);
            const fileBuffer = fs.readFileSync(filePath);

            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
            res.setHeader("Content-Disposition", `attachment; filename="${files[0]}"`);
            res.setHeader("Content-Length", fileBuffer.length.toString());

            return res.send(fileBuffer);
        } catch (error: any) {
            console.error("❌ Slide download error:", error.message);
            return res.status(500).json({
                error: "Download Failed",
                message: error.message,
            });
        }
    }
);

export const slidesRouter = router;
