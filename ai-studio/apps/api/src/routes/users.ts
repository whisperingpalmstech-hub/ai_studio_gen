import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { BadRequestError } from "../middleware/error.js";

const router = Router();

// POST /api/v1/users/upgrade - Upgrade user tier (Dummy)
router.post("/upgrade", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { tier } = req.body;

    if (tier !== "pro") {
        throw new BadRequestError("Invalid tier");
    }

    // Update user profile
    const { data: profile, error } = await (supabaseAdmin
        .from("profiles") as any)
        .update({
            tier: "pro",
            credits: 1000, // Reset to 1000 on upgrade
            updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
        .select()
        .single();

    if (error) {
        console.error("Failed to upgrade user:", error);
        throw new Error("Failed to upgrade user");
    }

    res.json(profile);
});

// POST /api/v1/users/init - Initialize user profile if missing
router.post("/init", async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;

    // Check if profile exists
    const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

    if (existing) {
        return res.json({ message: "Profile already exists" });
    }

    // Create profile with default 25 credits
    const { data: profile, error } = await (supabaseAdmin
        .from("profiles") as any)
        .insert({
            id: user.id,
            email: user.email,
            credits: 25, // Default for new users
            tier: "free",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to create profile:", error);
        throw new Error("Failed to create profile");
    }

    res.status(201).json(profile);
});

export { router as usersRouter };
