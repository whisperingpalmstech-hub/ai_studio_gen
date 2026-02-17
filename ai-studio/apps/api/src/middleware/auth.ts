import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";

// Supabase admin client (bypasses RLS)
const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
);

// User info attached to authenticated requests
export interface AuthUser {
    id: string;
    email: string;
    tier: string;
    credits: number;
}

// Use any for AuthenticatedRequest to bypass type checking during build
export type AuthenticatedRequest = any;

// =====================================================
// System user for API key access
// =====================================================
const SYSTEM_USER_EMAIL = "api-system@aistudio.local";
const SYSTEM_USER_PASSWORD = "aistudio-system-user-internal-2026!";

// Cached system user info so we only create/look up once
let cachedSystemUser: AuthUser | null = null;

/**
 * Ensures a system user exists in auth.users AND profiles tables.
 * Creates it via Supabase Admin Auth API if it doesn't exist.
 * Caches the result for subsequent requests.
 */
async function getOrCreateSystemUser(): Promise<AuthUser> {
    if (cachedSystemUser) return cachedSystemUser;

    // 1. Try to find existing system user by email
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existingUser = listData?.users?.find(
        (u: any) => u.email === SYSTEM_USER_EMAIL
    );

    let userId: string;

    if (existingUser) {
        userId = existingUser.id;
    } else {
        // 2. Create the system user via Admin Auth API
        const { data: newUser, error: createError } =
            await supabase.auth.admin.createUser({
                email: SYSTEM_USER_EMAIL,
                password: SYSTEM_USER_PASSWORD,
                email_confirm: true, // Auto-confirm
                user_metadata: { full_name: "API System User" },
            });

        if (createError || !newUser?.user) {
            console.error("Failed to create system user:", createError);
            throw new Error("Failed to create API system user");
        }
        userId = newUser.user.id;
        console.log(`✅ Created API system user with ID: ${userId}`);
    }

    // 3. Ensure profile exists (the trigger should handle this, but be safe)
    const { data: profile } = await supabase
        .from("profiles")
        .select("tier, credits")
        .eq("id", userId)
        .single();

    if (!profile) {
        // Profile trigger might not have fired; insert manually
        await supabase.from("profiles").upsert({
            id: userId,
            email: SYSTEM_USER_EMAIL,
            full_name: "API System User",
            tier: "pro",
            credits: 99999,
        });
    }

    cachedSystemUser = {
        id: userId,
        email: SYSTEM_USER_EMAIL,
        tier: profile?.tier || "pro",
        credits: profile?.credits || 99999,
    };

    return cachedSystemUser;
}

export async function authMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Missing or invalid authorization header",
            });
        }

        const token = authHeader.split(" ")[1];

        // Verify JWT token from Supabase
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Invalid or expired token",
            });
        }

        // Get user profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("tier, credits")
            .eq("id", user.id)
            .single();

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email!,
            tier: profile?.tier || "free",
            credits: profile?.credits || 0,
        };

        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Authentication failed",
        });
    }
}

// Optional auth middleware (doesn't require auth, but attaches user if present)
export async function optionalAuthMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    try {
        const token = authHeader.split(" ")[1];
        const {
            data: { user },
        } = await supabase.auth.getUser(token);

        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("tier, credits")
                .eq("id", user.id)
                .single();

            req.user = {
                id: user.id,
                email: user.email!,
                tier: profile?.tier || "free",
                credits: profile?.credits || 0,
            };
        }
    } catch (error) {
        // Silent fail for optional auth
    }

    next();
}

// API Key middleware for external app access
export async function apiKeyMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey || !config.apiKey || apiKey !== config.apiKey) {
        return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or missing API key. Set x-api-key header.",
        });
    }

    try {
        // Get or create the system user (real UUID in auth.users + profiles)
        req.user = await getOrCreateSystemUser();
        next();
    } catch (error) {
        console.error("API Key auth error:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to initialize API system user",
        });
    }
}

// Flexible auth: accepts either Bearer JWT OR x-api-key
export async function flexAuthMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    // Try API key first
    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey && config.apiKey && apiKey === config.apiKey) {
        try {
            req.user = await getOrCreateSystemUser();
            return next();
        } catch (error) {
            console.error("API Key auth error:", error);
            return res.status(500).json({
                error: "Internal Server Error",
                message: "Failed to initialize API system user",
            });
        }
    }

    // Fall back to Supabase JWT auth
    return authMiddleware(req, res, next);
}
