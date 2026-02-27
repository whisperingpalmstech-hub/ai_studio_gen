import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { jobsRouter } from "./routes/jobs.js";
import { modelsRouter } from "./routes/models.js";
import { usersRouter } from "./routes/users.js";
import { uploadsRouter } from "./routes/uploads.js";
import { assetsRouter } from "./routes/assets.js";
import { generationsRouter } from "./routes/generations.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/error.js";
import { authMiddleware, flexAuthMiddleware } from "./middleware/auth.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 1. GLOBAL CORS + PREFLIGHT HANDLER (TOP PRIORITY)
// This must be the very first middleware to handle Vercel -> Localhost requests
app.use((req: any, res: any, next) => {
    const origin = req.headers.origin;
    console.log(`🌐 CORS Check: ${req.method} from ${origin || 'unknown origin'} to ${req.url}`);

    // Allow any origin that includes vercel.app or localhost
    if (origin && (origin.includes("vercel.app") || origin.includes("localhost"))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "*"); // Allow all headers
    res.setHeader("Access-Control-Expose-Headers", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight for 24h

    // Handle Preflight
    if (req.method === "OPTIONS") {
        return res.status(204).send();
    }
    next();
});

// 2. Security & Utilities
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Static files
app.use("/outputs", express.static("public"));

// Health check (no auth required)
app.use("/health", healthRouter);

// API routes (auth required — flexAuth accepts both JWT and API key)
app.use("/api/v1/jobs", flexAuthMiddleware, jobsRouter);
app.use("/api/v1/models", flexAuthMiddleware, modelsRouter);
app.use("/api/v1/users", authMiddleware, usersRouter);
app.use("/api/v1/uploads", flexAuthMiddleware, uploadsRouter);
app.use("/api/v1/assets", flexAuthMiddleware, assetsRouter);
app.use("/api/v1/generations", authMiddleware, generationsRouter);

// 404 handler
app.use((req: any, res: any) => {
    res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 AI Studio API server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Initialize WebSocket Services
import { webSocketService } from "./services/websocket.js";
import { comfyUIWebSocketService } from "./services/comfyui-ws.js";

webSocketService.initialize(server);
comfyUIWebSocketService.initialize();

// Initialize Dynamic Model Scanner
import { modelScannerService } from "./services/model-scanner.js";
modelScannerService.start();

// Initialize Job Monitor (supabse-to-websocket relay)
import { jobMonitorService } from "./services/job-monitor.js";
jobMonitorService.start();

// Global error handlers — prevent process crashes on Render
process.on("unhandledRejection", (reason: any) => {
    console.error("⚠️ Unhandled Promise Rejection (caught):", reason?.message || reason);
});

process.on("uncaughtException", (err) => {
    console.error("⚠️ Uncaught Exception (caught):", err.message);
    // Don't exit — keep server alive on Render
});

export default app;
