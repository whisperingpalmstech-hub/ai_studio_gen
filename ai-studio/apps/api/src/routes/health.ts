import { Router } from "express";

const router = Router();

// Health check endpoint
router.get("/", (req: any, res: any) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "0.1.0",
    });
});

// Readiness check (for k8s)
router.get("/ready", async (req: any, res: any) => {
    // TODO: Add database and Redis connectivity checks
    res.json({
        status: "ready",
        checks: {
            database: "ok",
            redis: "ok",
        },
    });
});

// Liveness check (for k8s)
router.get("/live", (req: any, res: any) => {
    res.json({
        status: "live",
    });
});

export { router as healthRouter };
