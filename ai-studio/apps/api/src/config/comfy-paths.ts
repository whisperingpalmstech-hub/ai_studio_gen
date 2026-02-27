
import path from "path";

// Enterprise Grade: Centralized path management
// Uses environment variables for cloud deployment, falls back to local paths
export const COMFYUI_ROOT = process.env.COMFYUI_ROOT || "/media/sujeetnew/4TB HDD/AiModels/ComfyUI";
export const COMFYUI_INPUT_DIR = process.env.COMFYUI_INPUT_DIR || path.join(COMFYUI_ROOT, "input");
export const COMFYUI_OUTPUT_DIR = process.env.COMFYUI_OUTPUT_DIR || path.join(COMFYUI_ROOT, "output");

// Whether we're running in cloud mode (no local ComfyUI)
export const IS_CLOUD_MODE = process.env.NODE_ENV === "production" && !process.env.COMFYUI_ROOT;
