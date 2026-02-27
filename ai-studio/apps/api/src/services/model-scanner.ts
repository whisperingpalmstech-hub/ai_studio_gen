
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "./supabase.js";
import { COMFYUI_ROOT, IS_CLOUD_MODE } from "../config/comfy-paths.js";

export type ModelType = "checkpoint" | "lora" | "embedding" | "controlnet" | "vae" | "upscaler" | "unet";

interface ScanConfig {
    directory: string;
    type: ModelType;
}

const MODEL_DIRS: ScanConfig[] = [
    { directory: "models/checkpoints", type: "checkpoint" },
    { directory: "models/vae", type: "vae" },
    { directory: "models/unet", type: "unet" },
    { directory: "models/loras", type: "lora" },
    { directory: "models/upscale_models", type: "upscaler" },
    { directory: "models/controlnet", type: "controlnet" }
];

const VALID_EXTENSIONS = [".safetensors", ".ckpt", ".pt", ".bin"];

export class ModelScannerService {
    private isScanning = false;

    /**
     * Entry point to start the periodic scanner
     */
    public start() {
        if (IS_CLOUD_MODE) {
            console.log("☁️ Cloud mode detected — Model Scanner disabled (no local ComfyUI).");
            return;
        }
        console.log("🚀 Initializing Dynamic Model Scanner...");

        // Initial scan
        this.scan().catch(err => console.error("❌ Initial model scan failed:", err));

        // Periodic scan every 60 seconds
        setInterval(() => {
            if (!this.isScanning) {
                this.scan().catch(err => console.error("❌ Periodic model scan failed:", err));
            }
        }, 60000);
    }

    /**
     * Scans ComfyUI directories and synchronizes with the database
     */
    public async scan() {
        this.isScanning = true;
        console.log("🔍 Scanning ComfyUI models...");

        try {
            const foundFiles: { path: string, type: ModelType, size: number, mtime: Date }[] = [];

            // 1. Walk through directories
            for (const config of MODEL_DIRS) {
                const fullDir = path.join(COMFYUI_ROOT, config.directory);

                if (!fs.existsSync(fullDir)) {
                    console.warn(`⚠️ Scanner: Directory not found: ${fullDir}`);
                    continue;
                }

                const files = fs.readdirSync(fullDir, { recursive: true }) as string[];

                for (const file of files) {
                    const ext = path.extname(file).toLowerCase();
                    if (VALID_EXTENSIONS.includes(ext)) {
                        const filePath = path.join(fullDir, file);
                        const stats = fs.statSync(filePath);

                        // We store the filename as the unique identifier (file_path in DB)
                        // Note: ComfyUI identifies models by their relative path from the type folder
                        foundFiles.push({
                            path: file,
                            type: config.type,
                            size: stats.size,
                            mtime: stats.mtime
                        });
                    }
                }
            }

            console.log(`📊 Found ${foundFiles.length} files in ComfyUI directories.`);

            // 2. Fetch all system/local models from DB
            const { data: dbModels, error: fetchError } = await (supabaseAdmin
                .from("models") as any)
                .select("id, file_path, installed")
                .eq("is_system", true);

            if (fetchError) throw fetchError;

            const dbModelMap = new Map<string, any>();
            dbModels?.forEach(m => dbModelMap.set(m.file_path, m));

            // 3. Reconcile
            const foundPaths = new Set(foundFiles.map(f => f.path));

            // A. Update models that are missing from disk (mark installed = false)
            for (const dbModel of dbModels || []) {
                if (!foundPaths.has(dbModel.file_path)) {
                    try {
                        console.log(`📉 Model removed from disk: ${dbModel.file_path}. Marking as uninstalled.`);
                        await (supabaseAdmin.from("models") as any)
                            .update({ installed: false })
                            .eq("id", dbModel.id);
                    } catch (e) {
                        console.warn(`⚠️ Could not update installed status (Column might be missing): ${dbModel.file_path}`);
                    }
                }
            }

            // B. Add new models or update existing ones (mark installed = true)
            for (const file of foundFiles) {
                const existing = dbModelMap.get(file.path);

                if (!existing) {
                    // New model found!
                    const metadata = this.inferMetadata(file.path, file.type);
                    console.log(`✨ New model detected: ${file.path}. Registering...`);

                    try {
                        await (supabaseAdmin.from("models") as any).insert({
                            name: this.cleanName(file.path),
                            type: file.type === "unet" ? "checkpoint" : file.type,
                            file_path: file.path,
                            file_size: file.size,
                            is_system: true,
                            is_public: true,
                            installed: true,
                            metadata: metadata,
                            base_model: metadata.architecture === "sdxl" ? "sdxl" :
                                metadata.architecture === "sd15" ? "sd15" :
                                    metadata.architecture === "flux" ? "flux" : "other"
                        });
                    } catch (e) {
                        console.error(`❌ Failed to register new model: ${file.path}. Check if 'installed' column exists.`);
                    }
                } else {
                    try {
                        await (supabaseAdmin.from("models") as any)
                            .update({ installed: true, file_size: file.size })
                            .eq("id", existing.id);
                    } catch (e) {
                        // Probably missing column
                    }
                }
            }

            console.log("✅ Model synchronization complete.");
        } catch (err) {
            console.error("❌ Scanner error:", err);
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Infers model metadata based on filename and type
     */
    private inferMetadata(filename: string, type: ModelType) {
        const lower = filename.toLowerCase();
        const metadata: any = {
            compatibleWorkflows: [],
            architecture: "other",
            inputType: "text"
        };

        // 1. Architecture Detection
        if (lower.includes("sdxl") || lower.includes("sd_xl")) {
            metadata.architecture = "sdxl";
        } else if (lower.includes("sd1.5") || lower.includes("v1-5") || lower.includes("stable-diffusion-v1-5")) {
            metadata.architecture = "sd15";
        } else if (lower.includes("flux")) {
            metadata.architecture = "flux";
        } else if (lower.includes("wan")) {
            metadata.architecture = "wan2.1";
        } else if (lower.includes("svd")) {
            metadata.architecture = "svd";
        } else if (lower.includes("esrgan") || lower.includes("realesrgan")) {
            metadata.architecture = "esrgan";
        }

        // 2. Workflow Compatibility
        if (type === "checkpoint") {
            metadata.compatibleWorkflows = ["text_to_image", "image_to_image"];
            metadata.inputType = "text+image";

            if (lower.includes("inpaint")) {
                metadata.compatibleWorkflows = ["inpaint"];
            }

            if (metadata.architecture === "wan2.1") {
                if (lower.includes("t2v")) {
                    metadata.compatibleWorkflows = ["text_to_video"];
                    metadata.inputType = "text";
                } else if (lower.includes("i2v")) {
                    metadata.compatibleWorkflows = ["image_to_video"];
                    metadata.inputType = "text+image";
                }
            } else if (metadata.architecture === "svd") {
                metadata.compatibleWorkflows = ["image_to_video"];
                metadata.inputType = "image";
            }
        } else if (type === "upscaler") {
            metadata.compatibleWorkflows = ["upscale"];
            metadata.inputType = "image";
        } else if (type === "unet") {
            // Unets usually work like checkpoints in many workflows
            metadata.compatibleWorkflows = ["text_to_image", "image_to_image"];
        }

        return metadata;
    }

    private cleanName(filename: string): string {
        // Remove extension and common suffixes
        return filename
            .replace(/\.(safetensors|ckpt|pt|bin)$/i, "")
            .replace(/[_-]/g, " ")
            .trim();
    }
}

export const modelScannerService = new ModelScannerService();
