import { Router, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { BadRequestError, NotFoundError, ForbiddenError } from "../middleware/error.js";

const router = Router();

// GET /api/v1/models - List available models
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user!;
        const { type, base_model, is_public, limit = 50, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from("models")
            .select("*", { count: "exact" })
            .eq("installed", true) // Only show models actually present on disk
            .or(`user_id.eq.${user.id},is_public.eq.true,is_system.eq.true`)
            .order("created_at", { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (type) {
            query = query.eq("type", type);
        }
        if (base_model) {
            query = query.eq("base_model", base_model);
        }
        if (is_public === "true") {
            query = query.eq("is_public", true);
        }

        const { data: models, count, error } = await query;

        if (error) {
            console.error("Supabase models query error:", error);
            return res.status(500).json({ error: "Failed to fetch models", details: error.message });
        }

        res.json({
            data: models,
            pagination: {
                total: count,
                limit: Number(limit),
                offset: Number(offset),
            },
        });
    } catch (err: any) {
        console.error("Models route error:", err);
        res.status(500).json({ error: "Internal error", message: err.message });
    }
});

// GET /api/v1/models/:id - Get model details
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;

    const { data: model, error } = await supabaseAdmin
        .from("models")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !model) {
        throw new NotFoundError("Model not found");
    }

    // Check access
    const m = model as any;
    if (!m.is_public && !m.is_system && m.user_id !== user.id) {
        throw new ForbiddenError("You don't have access to this model");
    }

    res.json(model);
});

// POST /api/v1/models - Create/upload a model (metadata only)
const createModelSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    type: z.enum(["checkpoint", "lora", "embedding", "controlnet", "vae", "upscaler"]),
    base_model: z.enum(["sd15", "sd21", "sdxl", "flux", "other"]).optional().default("sd15"),
    file_path: z.string(),
    file_size: z.number().optional(),
    sha256: z.string().optional(),
    thumbnail_url: z.string().optional(),
    trigger_words: z.array(z.string()).optional(),
    is_public: z.boolean().optional().default(false),
});

router.post("/", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const body = createModelSchema.parse(req.body);

    const { data: model, error } = await (supabaseAdmin
        .from("models")
        .insert({
            ...body,
            user_id: user.id,
        } as any)
        .select()
        .single() as any);

    if (error) {
        console.error("Failed to create model:", error);
        throw new Error("Failed to create model");
    }

    res.status(201).json(model);
});

// PUT /api/v1/models/:id - Update model
const updateModelSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    thumbnail_url: z.string().optional(),
    trigger_words: z.array(z.string()).optional(),
    is_public: z.boolean().optional(),
});

router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;
    const body = updateModelSchema.parse(req.body);

    // Check ownership
    const { data: existing } = await supabaseAdmin
        .from("models")
        .select("user_id")
        .eq("id", id)
        .single();

    if (!existing || (existing as any).user_id !== user.id) {
        throw new ForbiddenError("You can only update your own models");
    }

    const { data: model, error } = await ((supabaseAdmin as any)
        .from("models")
        .update(body)
        .eq("id", id)
        .select()
        .single());

    if (error) {
        throw new Error("Failed to update model");
    }

    res.json(model);
});

// DELETE /api/v1/models/:id - Delete model
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { id } = req.params;

    // Check ownership
    const { data: existing } = await supabaseAdmin
        .from("models")
        .select("user_id, is_system")
        .eq("id", id)
        .single();

    if (!existing) {
        throw new NotFoundError("Model not found");
    }

    const m = existing as any;
    if (m.is_system) {
        throw new ForbiddenError("Cannot delete system models");
    }

    if (m.user_id !== user.id) {
        throw new ForbiddenError("You can only delete your own models");
    }

    const { error } = await supabaseAdmin
        .from("models")
        .delete()
        .eq("id", id);

    if (error) {
        throw new Error("Failed to delete model");
    }

    res.status(204).send();
});

export { router as modelsRouter };
