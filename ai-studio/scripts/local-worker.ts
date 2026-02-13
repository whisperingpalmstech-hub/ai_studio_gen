
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: 'apps/api/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

// Enterprise Grade: Absolute path to ComfyUI input folder
const COMFYUI_INPUT_DIR = '/home/sujeetnew/Downloads/Ai-Studio/Ai-Studio-/ComfyUI/input';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("🚀 Starting Local AI Worker...");
console.log(`📍 Supabase: ${SUPABASE_URL}`);
console.log(`📍 ComfyUI: ${COMFYUI_URL}`);
console.log(`📍 ComfyUI Input: ${COMFYUI_INPUT_DIR}`);

async function uploadImageToComfy(dataUrl: string, filename: string) {
    try {
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) return;
        const buffer = Buffer.from(base64Data, 'base64');

        // 1. Save to ComfyUI input directory immediately (FOR ENTERPRISE RELIABILITY)
        const fullPath = path.join(COMFYUI_INPUT_DIR, filename);
        fs.writeFileSync(fullPath, buffer);
        console.log(`💾 Saved file to persistent storage: ${fullPath} (${buffer.length} bytes)`);

        // 2. Also upload via API (Double-safe)
        const form = new FormData();
        form.append('image', buffer, { filename, contentType: 'image/png' });
        form.append('overwrite', 'true');

        await axios.post(`${COMFYUI_URL}/upload/image`, form, {
            headers: form.getHeaders()
        });
        console.log(`📤 Notified ComfyUI API of upload: ${filename}`);

        // 3. Verify existence before proceeding
        if (!fs.existsSync(fullPath)) {
            throw new Error(`CRITICAL: Image file ${filename} not found in ComfyUI input folder after save attempt`);
        }
    } catch (err: any) {
        console.error(`❌ FAILED to prepare image: ${err.message}`);
        throw err; // Propagate to job failure
    }
}

// Import the workflow generator logic (Simplified for the script)

// === ReactFlow to ComfyUI Converter (Enterprise Grade) ===
interface ReactFlowNode {
    id: string;
    type: string;
    data: any;
}

interface ReactFlowEdge {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

interface ComfyINode {
    class_type: string;
    inputs: Record<string, any>;
}

function convertReactFlowToComfyUI(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): Record<string, ComfyINode> {
    const comfyWorkflow: Record<string, ComfyINode> = {};

    nodes.forEach(node => {
        let class_type = "";
        let inputs: Record<string, any> = {};

        switch (node.type) {
            case "loadModel":
                class_type = "CheckpointLoaderSimple";
                inputs["ckpt_name"] = node.data.model || "sd_xl_base_1.0.safetensors";
                break;
            case "prompt":
                class_type = "CLIPTextEncode";
                inputs["text"] = node.data.prompt || "";
                break;
            case "sampler":
                class_type = "KSampler";
                inputs["seed"] = node.data.seed || Math.floor(Math.random() * 10000000);
                inputs["steps"] = node.data.steps || 20;
                inputs["cfg"] = node.data.cfg || 8.0;
                inputs["sampler_name"] = node.data.sampler || "euler";
                inputs["scheduler"] = node.data.scheduler || "normal";
                inputs["denoise"] = node.data.denoise ?? 1.0;
                break;
            case "emptyLatent":
                class_type = "EmptyLatentImage";
                inputs["width"] = node.data.width || 512;
                inputs["height"] = node.data.height || 512;
                inputs["batch_size"] = node.data.batch_size || 1;
                break;
            case "vaeEncode":
                class_type = "VAEEncode";
                break;
            case "vaeDecode":
                class_type = "VAEDecode";
                break;
            case "output":
                class_type = "SaveImage";
                inputs["filename_prefix"] = "AiStudio_WF";
                break;
            case "loadImage":
                class_type = "LoadImage";
                inputs["image"] = node.data.filename || "example.png";
                inputs["upload"] = "image";
                break;
            case "lora":
                class_type = "LoraLoader";
                inputs["lora_name"] = node.data.lora_name || "";
                inputs["strength_model"] = node.data.strength_model || 1.0;
                inputs["strength_clip"] = node.data.strength_clip || 1.0;
                break;
            case "controlNet": {
                const loaderId = `${node.id}_loader`;
                comfyWorkflow[loaderId] = {
                    class_type: "ControlNetLoader",
                    inputs: { control_net_name: node.data.model || "" }
                };
                class_type = "ControlNetApply";
                inputs["strength"] = node.data.strength || 1.0;
                inputs["control_net"] = [loaderId, 0];
                break;
            }
            case "videoCombine":
                class_type = "VHS_VideoCombine";
                inputs["frame_rate"] = node.data.fps || 16;
                inputs["loop_count"] = 0;
                inputs["filename_prefix"] = "AiStudio_WF_Video";
                inputs["format"] = "video/h264-mp4";
                inputs["pix_fmt"] = "yuv420p";
                inputs["crf"] = 19;
                inputs["save_output"] = true;
                break;

            // Wan 2.1 Native Node Support
            case "unetLoader":
                class_type = "UNETLoader";
                inputs["unet_name"] = node.data.model || "wan2.1_t2v_1.3B_bf16.safetensors";
                inputs["weight_dtype"] = "default";
                break;
            case "clipLoader":
                class_type = "CLIPLoader";
                inputs["clip_name"] = node.data.model || "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
                inputs["type"] = "wan";
                break;
            case "vaeLoader":
                class_type = "VAELoader";
                inputs["vae_name"] = node.data.model || "wan_2.1_vae.safetensors";
                break;
            case "clipVision":
                class_type = "CLIPVisionLoader";
                inputs["clip_name"] = node.data.model || "clip_vision_h.safetensors";
                break;
            case "clipVisionEncode":
                class_type = "CLIPVisionEncode";
                inputs["crop"] = "center";
                break;
            case "wanI2V":
                class_type = "WanImageToVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                break;
            case "wanT2V":
                class_type = "KSampler";
                inputs["seed"] = node.data.seed || Math.floor(Math.random() * 10000000);
                inputs["steps"] = node.data.steps || 30;
                inputs["cfg"] = node.data.cfg || 6.0;
                inputs["sampler_name"] = "uni_pc_bh2";
                inputs["scheduler"] = "simple";
                inputs["denoise"] = 1.0;
                break;
            case "wanEmptyLatent":
                class_type = "EmptyHunyuanLatentVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                inputs["batch_size"] = 1;
                break;

            default:
                class_type = node.type;
                inputs = { ...node.data };
        }

        comfyWorkflow[node.id] = { class_type, inputs };
    });

    edges.forEach(edge => {
        const targetNode = comfyWorkflow[edge.target];
        if (!targetNode) return;

        let inputName = edge.targetHandle || "";
        const handleMap: Record<string, string> = {
            "latent_in": "latent_image", "clip_in": "clip", "model_in": "model",
            "conditioning_in": "conditioning", "image_in": "image", "pixels": "pixels",
            "vae": "vae", "samples": "samples", "mask": "mask", "clip_vision": "clip_vision",
            "images": "images", "start_image": "start_image", "model": "model",
            "positive": "positive", "negative": "negative", "latent": "latent_image",
            "clip": "clip", "vae_in": "vae"
        };
        if (handleMap[inputName]) inputName = handleMap[inputName];
        if (targetNode.class_type === "VAEDecode" && inputName === "latent") inputName = "samples";

        if (inputName) {
            let outputIndex = 0;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceHandle = edge.sourceHandle;

            if (sourceNode?.type === "loadModel") {
                if (sourceHandle === "model") outputIndex = 0;
                else if (sourceHandle === "clip") outputIndex = 1;
                else if (sourceHandle === "vae") outputIndex = 2;
            } else if (sourceNode?.type === "lora") {
                if (sourceHandle === "model_out") outputIndex = 0;
                else if (sourceHandle === "clip_out") outputIndex = 1;
            } else if (sourceNode?.type === "wanI2V" || sourceNode?.type === "wanLoader") {
                if (sourceHandle === "positive") outputIndex = 0;
                else if (sourceHandle === "negative") outputIndex = 1;
                else outputIndex = 2;
            }
            // Add other index mappings as needed, but default 0 works for most

            targetNode.inputs[inputName] = [edge.source, outputIndex];
        }
    });

    return comfyWorkflow;
}

const generateSimpleWorkflow = (params: any) => {
    const type = params.type || "txt2img";
    const ID = {
        CHECKPOINT: "1",
        VAE_LOADER: "2",
        CLIP_LOADER: "3",
        PROMPT_POS: "4",
        PROMPT_NEG: "5",
        LATENT: "6",
        SAMPLER: "7",
        VAE_DECODE: "8",
        VHS_VIDEO_COMBINE: "9",
        LOAD_IMAGE: "10",
        CLIP_VISION: "11",
        CLIP_VISION_ENCODE: "12",
        WAN_I2V: "13",
        SAVE_PREVIEW: "14"
    };

    const workflow: Record<string, any> = {};
    let denoise = 1.0;

    // Standard Image Generation
    console.log(`🛠️ Generating workflow for type: ${type}`);
    if (type === "txt2img" || type === "img2img" || type === "inpaint" || type === "upscale") {
        const ID_OLD = {
            CHECKPOINT: "1",
            PROMPT_POS: "2",
            PROMPT_NEG: "3",
            LATENT_EMPTY: "4",
            SAMPLER: "5",
            VAE_DECODE: "6",
            SAVE_IMAGE: "7",
            LOAD_IMAGE: "8",
            VAE_ENCODE: "9",
            LOAD_MASK: "10",
            VAE_ENCODE_INPAINT: "11"
        };

        const ckptName = params.model_id || "sd_xl_base_1.0.safetensors";

        workflow[ID_OLD.CHECKPOINT] = {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: ckptName }
        };

        workflow[ID_OLD.PROMPT_POS] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.prompt || "", clip: [ID_OLD.CHECKPOINT, 1] }
        };

        workflow[ID_OLD.PROMPT_NEG] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.negative_prompt || "", clip: [ID_OLD.CHECKPOINT, 1] }
        };

        workflow[ID_OLD.VAE_DECODE] = {
            class_type: "VAEDecode",
            inputs: { samples: [ID_OLD.SAMPLER, 0], vae: [ID_OLD.CHECKPOINT, 2] }
        };

        workflow[ID_OLD.SAVE_IMAGE] = {
            class_type: "SaveImage",
            inputs: { filename_prefix: "AiStudio", images: [ID_OLD.VAE_DECODE, 0] }
        };

        let latentNodeId = ID_OLD.LATENT_EMPTY;
        denoise = 1.0;

        if (type === "txt2img") {
            workflow[ID_OLD.LATENT_EMPTY] = {
                class_type: "EmptyLatentImage",
                inputs: {
                    width: params.width || 1024,
                    height: params.height || 1024,
                    batch_size: 1
                }
            };
        } else if (type === "img2img" || type === "upscale") {
            const sourceImage = params.image_filename || "input.png";
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: sourceImage, upload: "image" }
            };

            let pixelNodeId = ID_OLD.LOAD_IMAGE;
            denoise = params.denoising_strength ?? (type === "upscale" ? 0.35 : 0.75);

            if (type === "upscale") {
                const UPSCALE_NODE = "15";
                workflow[UPSCALE_NODE] = {
                    class_type: "ImageScaleBy",
                    inputs: {
                        image: [ID_OLD.LOAD_IMAGE, 0],
                        upscale_method: "area",
                        scale_by: 2.0
                    }
                };
                pixelNodeId = UPSCALE_NODE;
            }

            workflow[ID_OLD.VAE_ENCODE] = {
                class_type: "VAEEncode",
                inputs: { pixels: [pixelNodeId, 0], vae: [ID_OLD.CHECKPOINT, 2] }
            };
            latentNodeId = ID_OLD.VAE_ENCODE;
        } else if (type === "inpaint") {
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename || "input.png", upload: "image" }
            };
            workflow[ID_OLD.LOAD_MASK] = {
                class_type: "LoadImage",
                inputs: { image: params.mask_filename || "mask.png", upload: "image" }
            };
            workflow[ID_OLD.VAE_ENCODE_INPAINT] = {
                class_type: "VAEEncodeForInpaint",
                inputs: {
                    pixels: [ID_OLD.LOAD_IMAGE, 0],
                    vae: [ID_OLD.CHECKPOINT, 2],
                    mask: [ID_OLD.LOAD_MASK, 1],
                    grow_mask_by: 6
                }
            };
            latentNodeId = ID_OLD.VAE_ENCODE_INPAINT;
            denoise = params.denoising_strength ?? 0.6;
        }

        const samplerMap: Record<string, string> = {
            "Euler a": "euler_ancestral",
            "euler_a": "euler_ancestral",
            "Euler": "euler",
            "DPM++ 2M": "dpmpp_2m",
            "UniPC": "uni_pc"
        };
        const comfySampler = samplerMap[params.sampler] || "euler";

        workflow[ID_OLD.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID_OLD.CHECKPOINT, 0],
                positive: [ID_OLD.PROMPT_POS, 0],
                negative: [ID_OLD.PROMPT_NEG, 0],
                latent_image: [latentNodeId, 0],
                seed: params.seed && params.seed !== -1 ? params.seed : Math.floor(Math.random() * 10000000),
                steps: params.steps || 20,
                cfg: params.cfg_scale || 7.0,
                sampler_name: comfySampler,
                scheduler: "normal",
                denoise: denoise
            }
        };
    }
    // Wan 2.1 Video Generation
    else if (type === "t2v" || type === "i2v") {
        let videoModel = params.model_id;
        if (!videoModel || !videoModel.toLowerCase().includes('wan')) {
            videoModel = (type === "t2v" ? "wan2.1_t2v_1.3B_bf16.safetensors" : "wan2.1_i2v_720p_14B_bf16.safetensors");
        }

        workflow[ID.CHECKPOINT] = {
            class_type: "UNETLoader",
            inputs: { unet_name: videoModel, weight_dtype: "default" }
        };

        workflow[ID.VAE_LOADER] = {
            class_type: "VAELoader",
            inputs: { vae_name: "wan_2.1_vae.safetensors" }
        };

        workflow[ID.CLIP_LOADER] = {
            class_type: "CLIPLoader",
            inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan" }
        };

        workflow[ID.PROMPT_POS] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.prompt || "", clip: [ID.CLIP_LOADER, 0] }
        };

        workflow[ID.PROMPT_NEG] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.negative_prompt || "blurry, low quality, distorted", clip: [ID.CLIP_LOADER, 0] }
        };

        if (type === "t2v") {
            workflow[ID.LATENT] = {
                class_type: "EmptyHunyuanLatentVideo",
                inputs: {
                    width: params.width || 832,
                    height: params.height || 480,
                    length: params.video_frames || 81,
                    batch_size: 1
                }
            };
        } else {
            // i2v
            workflow[ID.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename || "input.png", upload: "image" }
            };

            workflow[ID.CLIP_VISION] = {
                class_type: "CLIPVisionLoader",
                inputs: { clip_name: "clip_vision_h.safetensors" }
            };

            workflow[ID.CLIP_VISION_ENCODE] = {
                class_type: "CLIPVisionEncode",
                inputs: { clip_vision: [ID.CLIP_VISION, 0], image: [ID.LOAD_IMAGE, 0] }
            };

            workflow[ID.WAN_I2V] = {
                class_type: "WanImageToVideo",
                inputs: {
                    positive: [ID.PROMPT_POS, 0],
                    negative: [ID.PROMPT_NEG, 0],
                    vae: [ID.VAE_LOADER, 0],
                    start_image: [ID.LOAD_IMAGE, 0],
                    clip_vision_output: [ID.CLIP_VISION_ENCODE, 0],
                    width: params.width || 832,
                    height: params.height || 480,
                    length: params.video_frames || 81
                }
            };
        }

        workflow[ID.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID.CHECKPOINT, 0],
                positive: type === "t2v" ? [ID.PROMPT_POS, 0] : [ID.WAN_I2V, 0],
                negative: type === "t2v" ? [ID.PROMPT_NEG, 0] : [ID.WAN_I2V, 1],
                latent_image: type === "t2v" ? [ID.LATENT, 0] : [ID.WAN_I2V, 2],
                seed: params.seed && params.seed !== -1 ? Number(params.seed) : Math.floor(Math.random() * 10000000),
                steps: Number(params.steps) || 30,
                cfg: Number(params.cfg_scale) || 6.0,
                sampler_name: "uni_pc_bh2",
                scheduler: "simple",
                denoise: 1.0
            }
        };

        workflow[ID.VAE_DECODE] = {
            class_type: "VAEDecode",
            inputs: { samples: [ID.SAMPLER, 0], vae: [ID.VAE_LOADER, 0] }
        };

        workflow[ID.VHS_VIDEO_COMBINE] = {
            class_type: "VHS_VideoCombine",
            inputs: {
                images: [ID.VAE_DECODE, 0],
                frame_rate: params.fps || 16,
                loop_count: 0,
                filename_prefix: "AiStudio_Video",
                format: "video/h264-mp4",
                pix_fmt: "yuv420p",
                crf: 19,
                save_output: true
            }
        };

        // Single frame preview
        workflow[ID.SAVE_PREVIEW] = {
            class_type: "SaveImage",
            inputs: {
                filename_prefix: "AiStudio_Preview",
                images: [ID.VAE_DECODE, 0]
            }
        };
    }

    console.log("✅ Workflow generation complete. Nodes:", Object.keys(workflow));
    if (type === "img2img") {
        console.log("🖼️ Img2Img Path: Latent Node =", workflow["5"]?.inputs?.latent_image);
    }
    return workflow;
};

// Main processing loop
async function pollForJobs() {
    console.log("🔍 Checking for pending jobs...");

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) {
        console.error("❌ Error fetching jobs:", error.message);
        return;
    }

    if (jobs && jobs.length > 0) {
        const job = jobs[0];
        await processJob(job);
    }
}

async function processJob(job: any) {
    console.log(`📦 Processing Job ${job.id} (${job.type})`);

    try {
        // 1. Mark as processing
        await supabase.from('jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id);

        // 2. Enterprise Image Preparation
        let imageFilename = job.params.image_filename;
        let maskFilename = job.params.mask_filename;

        // Strict Enterprise Validation: Ensure required files exist on disk
        if (["img2img", "inpaint", "upscale", "i2v"].includes(job.type)) {
            if (!imageFilename) {
                // Legacy Fallback (Migration Period Only): Upload if dataURL exists but filename is missing
                if (job.params.image && typeof job.params.image === 'string' && job.params.image.startsWith("data:image")) {
                    imageFilename = `${job.id}.png`;
                    console.log(`📡 Legacy Upload Detected: Processing base64 as ${imageFilename}`);
                    await uploadImageToComfy(job.params.image, imageFilename);
                } else if (job.params.image_url && typeof job.params.image_url === 'string' && job.params.image_url.startsWith("data:image")) {
                    imageFilename = `${job.id}.png`;
                    console.log(`📡 Legacy Upload Detected: Processing base64 image_url as ${imageFilename}`);
                    await uploadImageToComfy(job.params.image_url, imageFilename);
                } else {
                    throw new Error(`Enterprise Integrity Error: Job type '${job.type}' requires an image_filename but none was provided and no source data found.`);
                }
            }

            const imagePath = path.join(COMFYUI_INPUT_DIR, imageFilename);
            if (!fs.existsSync(imagePath)) {
                console.log(`☁️ File ${imageFilename} missing locally. Checking Supabase Storage...`);
                // Try to find it in the user's inputs folder
                const storagePath = `inputs/${job.user_id}/${imageFilename}`;
                const { data, error } = await supabase.storage.from('assets').download(storagePath);

                if (error || !data) {
                    console.error(`❌ Cloud Retrieval Failed for ${storagePath}:`, error?.message);
                    throw new Error(`Enterprise File System Error: Required input file '${imageFilename}' missing from local storage and cloud storage.`);
                }

                const buffer = Buffer.from(await data.arrayBuffer());
                fs.writeFileSync(imagePath, buffer);
                console.log(`✅ Successfully synced ${imageFilename} from cloud to local storage.`);
            }
            console.log(`✅ Input Verified: ${imageFilename} exists and is ready.`);
        }

        // Handle Mask for Inpainting
        if (job.type === "inpaint") {
            if (!maskFilename) {
                if (job.params.mask && typeof job.params.mask === 'string' && job.params.mask.startsWith("data:image")) {
                    maskFilename = `mask_${job.id}.png`;
                    await uploadImageToComfy(job.params.mask, maskFilename);
                } else {
                    throw new Error(`Enterprise Integrity Error: Inpaint job requires a mask_filename.`);
                }
            }
            const maskPath = path.join(COMFYUI_INPUT_DIR, maskFilename);
            if (!fs.existsSync(maskPath)) {
                console.log(`☁️ Mask ${maskFilename} missing locally. Checking Supabase Storage...`);
                const storagePath = `inputs/${job.user_id}/${maskFilename}`;
                const { data, error } = await supabase.storage.from('assets').download(storagePath);

                if (error || !data) {
                    throw new Error(`Enterprise File System Error: Required mask file '${maskFilename}' missing from local and cloud storage.`);
                }

                const buffer = Buffer.from(await data.arrayBuffer());
                fs.writeFileSync(maskPath, buffer);
                console.log(`✅ Successfully synced mask ${maskFilename} from cloud.`);
            }
            console.log(`✅ Mask Verified: ${maskFilename} exists.`);
        }

        let workflow = job.params.workflow;
        if (!workflow) {
            console.log(`🛠️ Building Enterprise Workflow for: ${job.type}`);
            workflow = generateSimpleWorkflow({
                ...job.params,
                type: job.type,
                image_filename: imageFilename,
                mask_filename: maskFilename,
                model_id: job.params.model_id
            });
        } else if (workflow.nodes && workflow.edges) {
            // Enterprise Grade: Convert ReactFlow format back to ComfyUI API format
            console.log(`🔄 Detected ReactFlow data structure. Converting for ComfyUI...`);
            workflow = convertReactFlowToComfyUI(workflow.nodes, workflow.edges);
        }

        // 3. Send to ComfyUI
        const clientId = "local-worker-" + Math.random().toString(36).substring(7);

        // Setup WebSocket for progress with more debugging
        const wsUrl = `${COMFYUI_URL.replace(/^http/, 'ws')}/ws?clientId=${clientId}`;
        console.log(`🔌 Connecting to ComfyUI WS: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        let wsConnected = false;
        const wsPromise = new Promise((resolve) => {
            ws.on('open', () => {
                console.log(`✅ WS connected to ComfyUI for job ${job.id}`);
                wsConnected = true;
                resolve(true);
            });
            ws.on('error', (err) => {
                console.error(`❌ WS Error for job ${job.id}:`, err.message);
                resolve(false);
            });
            // Timeout after 5s
            setTimeout(() => {
                if (!wsConnected) {
                    console.warn(`🕒 WS connection timeout (5s) for job ${job.id}`);
                    resolve(false);
                }
            }, 5000);
        });

        ws.on('message', async (data: any) => {
            try {
                // Buffer to string handling
                const dataString = data.toString();
                const message = JSON.parse(dataString);

                if (message.type === 'progress') {
                    const progress = Math.round((message.data.value / message.data.max) * 100);
                    console.log(`⏳ Job ${job.id} progress: ${progress}%`);
                    const { error: upError } = await supabase.from('jobs').update({
                        progress,
                        status: 'processing',
                        current_node: 'Sampling'
                    }).eq('id', job.id);
                    if (upError) console.error("❌ Supabase Update Error (Progress):", upError.message);
                } else if (message.type === 'executing' && message.data.node) {
                    const nodeId = message.data.node;
                    console.log(`🎯 Executing node: ${nodeId}`);

                    const { error: upError } = await supabase.from('jobs').update({
                        current_node: nodeId, // Store actual ID so frontend can highlight the node
                        status: 'processing'
                    }).eq('id', job.id);

                    if (upError) console.error("❌ Supabase Update Error (Node):", upError.message);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        // Wait for WS to be ready (up to 5s)
        const ready = await wsPromise;
        if (!ready) {
            console.error("❌ WebSocket failed to connect. Falling back to polling only.");
        }

        let promptId;
        try {
            console.log(`📤 Submitting prompt to ComfyUI...`);
            console.log("------------------ PROMPT JSON ------------------");
            console.log(JSON.stringify(workflow, null, 2));
            console.log("-------------------------------------------------");
            const response = await axios.post(`${COMFYUI_URL}/prompt`, {
                prompt: workflow,
                client_id: clientId
            });
            promptId = response.data.prompt_id;
            console.log(`🚀 Queued in ComfyUI: ${promptId}`);
        } catch (axiosErr: any) {
            ws.close();
            if (axiosErr.response && axiosErr.response.data) {
                console.error("❌ ComfyUI Validation Error:", JSON.stringify(axiosErr.response.data));
                throw new Error(`ComfyUI Error: ${JSON.stringify(axiosErr.response.data)}`);
            }
            throw axiosErr;
        }

        // 4. Listen for completion
        let completed = false;
        let outputs = null;

        while (!completed) {
            try {
                const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
                const history = historyRes.data[promptId];

                // console.log(`🔍 Polling history for ${promptId}... Status:`, history?.status);

                if (history && history.status && history.status.completed) {
                    completed = true;
                    outputs = history.outputs;
                    console.log("✅ ComfyUI task completed. Outputs:", JSON.stringify(Object.keys(outputs || {})));
                    ws.close();
                } else if (history && history.status && history.status.status_str === 'error') {
                    ws.close();
                    throw new Error("ComfyUI Execution Error: " + JSON.stringify(history.status.messages));
                } else {
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) {
                // console.log("⚠️ History poll error (retrying):", e.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 5. Process and Upload Outputs
        const assetUrls: string[] = [];
        const nodeResults: Record<string, { url: string, type: string }[]> = {};

        for (const nodeId of Object.keys(outputs)) {
            const nodeOutput = outputs[nodeId];
            const outputFiles = nodeOutput.images || nodeOutput.gifs || nodeOutput.videos || [];

            if (outputFiles.length > 0) {
                nodeResults[nodeId] = [];
            }

            for (const file of outputFiles) {
                const isVideo = file.filename.endsWith('.mp4') || file.filename.endsWith('.webm') || file.filename.endsWith('.gif');
                const contentType = isVideo ?
                    (file.filename.endsWith('.mp4') ? 'video/mp4' : (file.filename.endsWith('.webm') ? 'video/webm' : 'image/gif'))
                    : 'image/png';

                console.log(`📥 Fetching output for node ${nodeId}: ${file.filename} (${contentType})`);

                const fileRes = await axios.get(`${COMFYUI_URL}/view`, {
                    params: { filename: file.filename, subfolder: file.subfolder, type: file.type },
                    responseType: 'arraybuffer'
                });

                const buffer = Buffer.from(fileRes.data);
                const storagePath = `generations/${job.user_id}/${job.id}/${file.filename}`;

                const { error: uploadError } = await supabase.storage
                    .from('assets')
                    .upload(storagePath, buffer, { contentType, upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath);
                assetUrls.push(publicUrl);
                nodeResults[nodeId].push({ url: publicUrl, type: isVideo ? 'video' : 'image' });

                const isVideoJob = job.type === 't2v' || job.type === 'i2v';
                const shouldAddToGallery = !isVideoJob || isVideo;

                if (shouldAddToGallery) {
                    await supabase
                        .from('assets')
                        .insert({
                            user_id: job.user_id,
                            job_id: job.id,
                            type: isVideo ? 'video' : 'image',
                            file_path: publicUrl,
                            prompt: job.params.prompt,
                            created_at: new Date().toISOString()
                        });
                }
            }
        }

        // 6. Complete Job
        await supabase.from('jobs').update({
            status: 'completed',
            progress: 100,
            outputs: assetUrls,
            results: nodeResults, // CRITICAL: This enables live preview in Workflow Editor
            completed_at: new Date().toISOString()
        }).eq('id', job.id);

        console.log(`✨ Job ${job.id} finished successfully`);

    } catch (err: any) {
        console.error(`❌ Job ${job.id} failed:`, err.message);
        await supabase.from('jobs').update({
            status: 'failed',
            error_message: err.message,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);
    }
}

// Reset stuck jobs on startup
async function resetStuckJobs() {
    console.log("🧹 Checking for stuck jobs...");
    const { data: stuckJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('status', 'processing');

    if (stuckJobs && stuckJobs.length > 0) {
        console.log(`⚠️ Found ${stuckJobs.length} stuck jobs. Resetting to 'pending'...`);
        for (const job of stuckJobs) {
            await supabase.from('jobs').update({ status: 'pending', current_node: null, progress: 0 }).eq('id', job.id);
        }
        console.log("✅ All stuck jobs reset.");
    } else {
        console.log("✅ No stuck jobs found.");
    }
}

// Polling interval
resetStuckJobs().then(() => {
    setInterval(pollForJobs, 1000);
    pollForJobs();
});
