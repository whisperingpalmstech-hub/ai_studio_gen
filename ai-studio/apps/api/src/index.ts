import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { jobsRouter } from "./routes/jobs.js";
import { modelsRouter } from "./routes/models.js";
import { usersRouter } from "./routes/users.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/error.js";
import { authMiddleware } from "./middleware/auth.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/outputs", express.static("public"));

// Health check (no auth required)
app.use("/health", healthRouter);

// API routes (auth required)
app.use("/api/v1/jobs", authMiddleware, jobsRouter);
app.use("/api/v1/models", authMiddleware, modelsRouter);
app.use("/api/v1/users", authMiddleware, usersRouter);

// 404 handler
app.use((req, res) => {
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

// Seed models on startup
import { seedModels } from "./seed-models.js";
seedModels().catch(err => console.error("Failed to seed models:", err));

export default app;
