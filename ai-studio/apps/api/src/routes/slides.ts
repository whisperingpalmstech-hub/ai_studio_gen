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

// Validation schema for custom slide content
const slideContentSchema = z.object({
    slideNumber: z.number().optional(),
    slideType: z.string().optional(),
    title: z.string().min(1, "Slide title is required"),
    subtitle: z.string().optional(),
    points: z.array(z.string()).optional().default([]),
    speakerNotes: z.string().optional(),
    visualDescription: z.string().optional(),
    colorAccent: z.string().optional(),
    image_prompt: z.string().optional().default(""),
});

// Validation schema
const generateSlidesSchema = z.object({
    topic: z.string().min(3, "Topic must be at least 3 characters").max(500),
    num_slides: z.number().min(3).max(15).optional().default(6),
    style: z.enum(["corporate", "creative", "minimal", "dark"]).optional().default("corporate"),
    slides: z.array(slideContentSchema).min(1).max(20).optional(),
    model_id: z.string().optional(),
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

            const isCustom = validated.slides && validated.slides.length > 0;
            console.log(`📊 Slide Generation Request from user ${user.id}: "${validated.topic}" [${isCustom ? 'Custom Content' : 'Grok AI'}]`);

            // Generate slides (this is the main pipeline)
            // user_id is needed so the service can create image jobs in Supabase
            // → local worker picks them up → ComfyUI generates → uploads to Storage
            const result = await generateSlides({
                topic: validated.topic,
                num_slides: validated.num_slides,
                style: validated.style,
                user_id: user.id,
                slides: validated.slides, // If provided, skips Grok and uses custom content
                model_id: validated.model_id, // Custom model for images (Flux, SD3.5, etc.)
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

            // Build slide type stats
            const slideTypes: Record<string, number> = {};
            presentation.slides.forEach((s: any) => {
                const t = s.slideType || 'content';
                slideTypes[t] = (slideTypes[t] || 0) + 1;
            });

            return res.json({
                success: true,
                presentation,
                summary: presentation.summary || `Presentation on: ${validated.topic}`,
                generatedAt: new Date().toISOString(),
                stats: {
                    totalSlides: presentation.slides.length,
                    slideTypes,
                    estimatedDuration: `${Math.round(presentation.slides.length * 2.5)} minutes`,
                },
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
