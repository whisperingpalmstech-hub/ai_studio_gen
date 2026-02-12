import { z } from "zod";
import dotenv from "dotenv";

// Load .env file from api directory
dotenv.config();

// Environment configuration schema - accepts both NEXT_PUBLIC_ and non-prefixed versions
const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("4000"),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    // Supabase (accept either naming convention)
    SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),

    // Redis
    REDIS_URL: z.string().default("redis://localhost:6379"),

    // JWT
    JWT_SECRET: z.string(),

    // ComfyUI
    COMFYUI_URL: z.string().default("http://127.0.0.1:8188"),

    // API
    API_URL: z.string().default("http://localhost:4000"),
}).refine(
    (data) => data.SUPABASE_URL || data.NEXT_PUBLIC_SUPABASE_URL,
    { message: "Either SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required" }
);

// Parse and validate environment
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.format());
    process.exit(1);
}

export const config = {
    env: parsed.data.NODE_ENV,
    port: parseInt(parsed.data.PORT, 10),
    corsOrigin: parsed.data.CORS_ORIGIN,

    supabase: {
        url: parsed.data.SUPABASE_URL || parsed.data.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    },

    redis: {
        url: parsed.data.REDIS_URL,
    },

    jwt: {
        secret: parsed.data.JWT_SECRET,
    },

    COMFYUI_URL: parsed.data.COMFYUI_URL,
    apiUrl: parsed.data.API_URL,

    // Credit costs for different operations
    creditCosts: {
        txt2img: 1,
        img2img: 1,
        inpaint: 2,
        outpaint: 2,
        upscale: 1,
        t2v: 5,
        i2v: 5,
        video: 10,
    },

    // Tier limits
    tierLimits: {
        free: {
            monthlyCredits: 100,
            maxParallelJobs: 2,
            maxResolution: 1024,
            maxSteps: 50,
        },
        standard: {
            monthlyCredits: 1000,
            maxParallelJobs: 3,
            maxResolution: 1024,
            maxSteps: 100,
        },
        pro: {
            monthlyCredits: 5000,
            maxParallelJobs: 5,
            maxResolution: 2048,
            maxSteps: 150,
        },
        enterprise: {
            monthlyCredits: -1, // Unlimited
            maxParallelJobs: 10,
            maxResolution: 4096,
            maxSteps: 150,
        },
    },
};

export type Config = typeof config;
