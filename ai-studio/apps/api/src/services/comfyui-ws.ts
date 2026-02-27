
import { WebSocket } from "ws";
import { webSocketService } from "./websocket.js";
import { config } from "../config/index.js";
import { supabaseAdmin } from "./supabase.js";

interface ProgressMessage {
    prompt_id: string;
    node: string;
    value: number;
    max: number;
}

interface ExecutingMessage {
    prompt_id: string;
    node: string | null;
}

class ComfyUIWebSocketService {
    private ws: WebSocket | null = null;
    private baseUrl: string;
    public clientId: string = "ai-studio-server";

    // Map of promptId -> { userId, jobId }
    private activePrompts: Map<string, { userId: string, jobId: string }> = new Map();

    constructor() {
        this.baseUrl = config.COMFYUI_URL || "http://127.0.0.1:8188";
        // Convert http to ws
        this.baseUrl = this.baseUrl.replace(/^http/, "ws");
    }

    public initialize() {
        // In cloud mode, worker handles ComfyUI directly — no WS needed from API
        if (process.env.NODE_ENV === "production" && !process.env.COMFYUI_ROOT) {
            console.log("☁️ Cloud mode — ComfyUI WebSocket relay disabled (worker handles it locally).");
            return;
        }
        this.connect();
    }

    private connect() {
        console.log(`Connecting to ComfyUI WebSocket: ${this.baseUrl}/ws?clientId=${this.clientId}`);
        this.ws = new WebSocket(`${this.baseUrl}/ws?clientId=${this.clientId}`);

        this.ws.on("open", () => {
            console.log("Connected to ComfyUI WebSocket");
        });

        this.ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (err) {
                // If it's not JSON, it might be binary (images), skip for now
            }
        });

        this.ws.on("close", () => {
            console.warn("ComfyUI WebSocket closed. Reconnecting in 5s...");
            setTimeout(() => this.connect(), 5000);
        });

        this.ws.on("error", (err: any) => {
            if (err.code === 'ECONNREFUSED') {
                console.error(`❌ ComfyUI Connection Refused at ${this.baseUrl}. ACTION REQUIRED: Ensure ComfyUI is running on port 8188.`);
            } else {
                console.error("ComfyUI WebSocket error:", err.message);
            }
        });
    }

    public registerPrompt(promptId: string, userId: string, jobId: string) {
        this.activePrompts.set(promptId, { userId, jobId });
    }

    public unregisterPrompt(promptId: string) {
        this.activePrompts.delete(promptId);
    }

    private async handleMessage(message: any) {
        const { type, data } = message;

        if (type === "progress") {
            const { value, max, prompt_id, node } = data as ProgressMessage;
            const promptInfo = this.activePrompts.get(prompt_id);
            if (promptInfo) {
                const percent = Math.round((value / max) * 100);

                // 1. Send via WebSocket (legacy/local)
                webSocketService.sendToUser(promptInfo.userId, {
                    type: "job_progress",
                    jobId: promptInfo.jobId,
                    progress: percent,
                    nodeId: node,
                    message: `Sampling... (${percent}%)`
                });

                // 2. Update Supabase for Realtime (production/Vercel)
                try {
                    await (supabaseAdmin
                        .from("jobs") as any)
                        .update({
                            progress: percent,
                            current_node: node,
                            status: "processing"
                        })
                        .eq("id", promptInfo.jobId);
                } catch (err) {
                    console.error("Failed to update job progress in Supabase:", err);
                }
            }
        } else if (type === "executing") {
            const { node, prompt_id } = data as ExecutingMessage;
            const promptInfo = this.activePrompts.get(prompt_id);
            if (promptInfo) {
                if (node !== null) {
                    // Reset progress for new node
                    webSocketService.sendToUser(promptInfo.userId, {
                        type: "job_progress",
                        jobId: promptInfo.jobId,
                        progress: 0,
                        message: `Starting Node: ${node}`
                    });

                    try {
                        await (supabaseAdmin
                            .from("jobs") as any)
                            .update({
                                progress: 0,
                                current_node: node,
                                status: "processing"
                            })
                            .eq("id", promptInfo.jobId);
                    } catch (err) {
                        console.error("Failed to update job node in Supabase:", err);
                    }
                }
            }
        } else if (type === "status") {
            // Can be used for queue status
        }
    }
}

export const comfyUIWebSocketService = new ComfyUIWebSocketService();
