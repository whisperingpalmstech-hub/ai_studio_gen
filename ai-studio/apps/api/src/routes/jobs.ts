import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { jobQueue } from "../queues/job-queue.js";
import { supabaseAdmin } from "../services/supabase.js";
import { BadRequestError, InsufficientCreditsError, NotFoundError } from "../middleware/error.js";
import { config } from "../config/index.js";
import { v4 as uuidv4 } from "uuid";
import { validateModelWorkflow } from "../services/model-registry.js";
import fs from "fs";
import path from "path";
import { COMFYUI_INPUT_DIR } from "../config/comfy-paths.js";

const router = Router();

// Validation schemas
const txt2imgSchema = z.object({
    prompt: z.string().min(1).max(2000),
    negative_prompt: z.string().max(2000).optional().default(""),
    width: z.number().min(128).max(2048).optional().default(512),
    height: z.number().min(128).max(2048).optional().default(512),
    steps: z.number().min(1).max(150).optional().default(20),
    cfg_scale: z.number().min(1).max(30).optional().default(7),
    seed: z.number().optional().default(-1),
    sampler: z.string().optional().default("euler_a"),
    model_id: z.string().min(1).optional(),
    lora_ids: z.array(z.string().uuid()).optional().default([]),
    batch_size: z.number().min(1).max(4).optional().default(1),
    batch_count: z.number().min(1).max(4).optional().default(1),
});

const img2imgSchema = txt2imgSchema.extend({
    image_url: z.string().optional(),
    image_filename: z.string().min(1, "Image is required for this workflow"),
    denoising_strength: z.number().min(0).max(1).optional().default(0.75),
});

const inpaintSchema = img2imgSchema.extend({
    mask_url: z.string().optional(),
    mask_filename: z.string().optional(),
});

const t2vSchema = z.object({
    prompt: z.string().min(1).max(2000),
    negative_prompt: z.string().max(2000).optional().default(""),
    width: z.number().min(128).max(2048).optional().default(832),
    height: z.number().min(128).max(2048).optional().default(480),
    steps: z.number().min(1).max(100).optional().default(30),
    guidance_scale: z.number().min(1).max(30).optional().default(6),
    video_frames: z.number().optional().default(81),
    fps: z.number().optional().default(16),
    seed: z.number().optional().default(-1),
    model_id: z.string().optional(),
});

const i2vSchema = t2vSchema.extend({
    image_url: z.string().optional(),
    image_filename: z.string().min(1, "Image is required for video animation"),
});

const workflowSchema = z.object({
    workflow: z.record(z.any()),
    prompt: z.string().optional(), // Metadata
});

// POST /api/v1/jobs - Create a new generation job
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const { type = "txt2img", ...params } = req.body;

        // Validate job type
        const validTypes = ["txt2img", "img2img", "inpaint", "outpaint", "upscale", "workflow", "t2v", "i2v"];
        if (!validTypes.includes(type)) {
            throw new BadRequestError(`Invalid job type: ${type}`);
        }

        // Validate params based on job type
        let validatedParams;
        try {
            switch (type) {
                case "txt2img":
                    validatedParams = txt2imgSchema.parse(params);
                    break;
                case "img2img":
                    validatedParams = img2imgSchema.parse(params);
                    break;
                case "inpaint":
                case "outpaint":
                    validatedParams = inpaintSchema.parse(params);
                    break;
                case "t2v":
                    validatedParams = t2vSchema.parse(params);
                    break;
                case "i2v":
                    validatedParams = i2vSchema.parse(params);
                    break;
                case "workflow":
                    validatedParams = workflowSchema.parse(params);
                    break;
                default:
                    validatedParams = params;
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new BadRequestError(
                    `Validation error: ${error.errors.map((e) => e.message).join(", ")}`
                );
            }
            throw error;
        }

        // Enterprise Grade: Validate model-workflow compatibility (FULLY DYNAMIC)
        if (validatedParams.model_id) {
            // 1. First check if it's in the DB for dynamic metadata
            const { data: dbModel } = await (supabaseAdmin as any)
                .from("models")
                .select("metadata")
                .eq("file_path", validatedParams.model_id)
                .maybeSingle();

            if (dbModel && (dbModel as any).metadata) {
                const { validateCompatibilityFromMetadata } = await import("../services/model-registry.js");
                const isCompatible = validateCompatibilityFromMetadata((dbModel as any).metadata, type);
                if (!isCompatible) {
                    throw new BadRequestError(`Model '${validatedParams.model_id}' is not compatible with workflow type '${type}' (Based on DB Metadata).`);
                }
            } else {
                // 2. Fallback to hardcoded registry for system models or if DB has no metadata
                const isCompatible = validateModelWorkflow(validatedParams.model_id, type);
                if (!isCompatible) {
                    throw new BadRequestError(`Model '${validatedParams.model_id}' is not compatible with workflow type '${type}'. Please select a valid model.`);
                }
            }
        }

        // Enterprise Grade: Verify image file existence on disk
        if (["img2img", "inpaint", "upscale", "i2v"].includes(type)) {
            const filename = (validatedParams as any).image_filename;
            if (!filename) {
                throw new BadRequestError(`Image is required for job type '${type}'.`);
            }
            const fullPath = path.join(COMFYUI_INPUT_DIR, filename);
            if (!fs.existsSync(fullPath)) {
                console.error(`❌ Validation Failed: File not found at ${fullPath}`);
                throw new BadRequestError(`Uploaded image '${filename}' not found on server. Please re-upload.`);
            }
            console.log(`✅ Job Validation: File verified at ${fullPath}`);
        }

        // Check tier limits
        const tierLimits = config.tierLimits[user.tier as keyof typeof config.tierLimits];
        if (validatedParams.width > tierLimits.maxResolution ||
            validatedParams.height > tierLimits.maxResolution) {
            throw new BadRequestError(
                `Resolution exceeds tier limit of ${tierLimits.maxResolution}px`
            );
        }
        if (validatedParams.steps > tierLimits.maxSteps) {
            throw new BadRequestError(
                `Steps exceeds tier limit of ${tierLimits.maxSteps}`
            );
        }

        // Calculate credit cost
        const baseCost = config.creditCosts[type as keyof typeof config.creditCosts] || 1;
        const batchMultiplier = (validatedParams.batch_size || 1) * (validatedParams.batch_count || 1);
        const creditCost = baseCost * batchMultiplier;

        // Check credits
        if (user.credits < creditCost) {
            throw new InsufficientCreditsError(creditCost, user.credits);
        }

        // Create job in database
        const jobId = uuidv4();
        const { data: job, error } = await (supabaseAdmin
            .from("jobs")
            .insert({
                id: jobId,
                user_id: user.id,
                type: type as any,
                status: "pending",
                priority: user.tier as any,
                params: validatedParams as any,
                credits_estimated: creditCost,
            } as any)
            .select()
            .single() as any);

        if (error) {
            console.error("Failed to create job:", error);
            throw new Error("Failed to create job");
        }

        // Add to job queue
        await jobQueue.add(
            type,
            {
                jobId: job.id,
                userId: user.id,
                type,
                params: validatedParams,
            },
            {
                priority: getPriorityNumber(user.tier),
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            }
        );

        // Deduct credits
        const { error: creditError } = await (supabaseAdmin
            .from("profiles") as any)
            .update({ credits: user.credits - creditCost })
            .eq("id", user.id);

        if (creditError) {
            console.error("Failed to deduct credits:", creditError);
            // Ideally rollback job creation here, but for now we proceed
        }

        // Update job status to queued
        await ((supabaseAdmin as any)
            .from("jobs")
            .update({ status: "queued", queued_at: new Date().toISOString() })
            .eq("id", job.id));

        res.status(201).json({
            id: job.id,
            type: job.type,
            status: "queued",
            credits_estimated: creditCost,
            created_at: job.created_at,
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/jobs - List user's jobs
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { limit = 20, offset = 0, status } = req.query;

    let query = supabaseAdmin
        .from("jobs")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && typeof status === "string") {
        query = query.eq("status", status);
    }

    const { data: jobs, count, error } = await query;

    if (error) {
        throw new Error("Failed to fetch jobs");
    }

    res.json({
        data: jobs,
        pagination: {
            total: count,
            limit: Number(limit),
            offset: Number(offset),
        },
    });
});

// GET /api/v1/jobs/:id - Get job details
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;

    const { data: job, error } = await supabaseAdmin
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (error || !job) {
        throw new NotFoundError("Job not found");
    }

    // Get associated assets
    const { data: assets } = await supabaseAdmin
        .from("assets")
        .select("*")
        .eq("job_id", id);

    res.json({
        ...(job as any),
        assets: assets || [],
    });
});

// DELETE /api/v1/jobs/:id - Delete or Cancel a job
router.delete("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const { id: jobId } = req.params;

        const { data: job, error } = await supabaseAdmin
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .eq("user_id", user.id)
            .single();

        if (error || !job) {
            throw new NotFoundError("Job not found");
        }

        const status = (job as any).status;

        // 1. If pending/queued, cancel it
        if (status === "pending" || status === "queued") {
            const queueJob = await jobQueue.getJob(jobId);
            if (queueJob) {
                await queueJob.remove();
            }

            await ((supabaseAdmin as any)
                .from("jobs")
                .update({ status: "cancelled" })
                .eq("id", jobId));

            return res.json({ message: "Job cancelled successfully" });
        }

        // 2. If completed/failed/cancelled, delete everything
        // Get assets to delete from storage
        const { data: assets } = await supabaseAdmin
            .from("assets")
            .select("file_path")
            .eq("job_id", jobId);

        if (assets && assets.length > 0) {
            // Extract storage paths from URLs if necessary, or use the path structure
            // In our current setup, we store public URLs or paths starting with /outputs
            // The storage path is generations/${userId}/${jobId}/${filename}
            const pathsToDelete = assets.map((a: any) => {
                const url = a.file_path;
                // If it's a full Supabase URL, we need to extract the path after 'assets/'
                if (url.includes('/assets/')) {
                    return url.split('/assets/')[1];
                }
                return url.replace('/outputs/', ''); // Fallback for old local paths
            });

            if (pathsToDelete.length > 0) {
                await supabaseAdmin.storage.from("assets").remove(pathsToDelete);
            }
        }

        // Delete from DB
        await (supabaseAdmin as any).from("assets").delete().eq("job_id", jobId);
        await (supabaseAdmin as any).from("jobs").delete().eq("id", jobId);

        res.json({ message: "Job and associated assets deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// Helper function to map tier to priority number (lower = higher priority)
function getPriorityNumber(tier: string): number {
    switch (tier) {
        case "enterprise":
            return 1;
        case "pro":
            return 2;
        case "standard":
            return 3;
        default:
            return 4;
    }
}

export { router as jobsRouter };
