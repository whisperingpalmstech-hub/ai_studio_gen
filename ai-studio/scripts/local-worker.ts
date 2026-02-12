
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';

// Load environment variables
dotenv.config({ path: 'apps/api/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("🚀 Starting Local AI Worker...");
console.log(`📍 Supabase: ${SUPABASE_URL}`);
console.log(`📍 ComfyUI: ${COMFYUI_URL}`);

// Import the workflow generator logic (Simplified for the script)
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

    // Standard Image Generation
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
        let denoise = 1.0;

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
            // Standard img2img logic
            denoise = params.denoising_strength ?? 0.75;
            // ... (rest of simple img2img if needed, keeping it compact for worker)
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
            // i2v logic...
        }

        workflow[ID.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID.CHECKPOINT, 0],
                positive: [ID.PROMPT_POS, 0],
                negative: [ID.PROMPT_NEG, 0],
                latent_image: [ID.LATENT, 0],
                seed: params.seed && params.seed !== -1 ? params.seed : Math.floor(Math.random() * 10000000),
                steps: params.steps || 30,
                cfg: params.cfg_scale || 6.0,
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

        // 2. Prepare Workflow
        // In a real implementation, we should import 'generateSimpleWorkflow' from the actual utils
        // For now, let's assume the params might be enough or we use a helper.
        let workflow = job.params.workflow;
        if (!workflow) {
            // If no workflow is provided (txt2img/img2img), generate one
            // This would normally use the generator from apps/api/src/utils/simple-workflow-generator.ts
            // For now, we'll try to reach out to that logic if we can, or use the placeholder.
            console.log("Generating simple workflow...");
            workflow = generateSimpleWorkflow(job.params);
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
                        current_node: 'KSampler'
                    }).eq('id', job.id);
                    if (upError) console.error("❌ Supabase Update Error (Progress):", upError.message);
                } else if (message.type === 'executing' && message.data.node) {
                    console.log(`🎯 Executing node: ${message.data.node}`);
                    const { error: upError } = await supabase.from('jobs').update({
                        current_node: message.data.node
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
            const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
            const history = historyRes.data[promptId];

            if (history && history.status && history.status.completed) {
                completed = true;
                outputs = history.outputs;
                console.log("✅ ComfyUI task completed");
                ws.close();
            } else if (history && history.status && history.status.status_str === 'error') {
                ws.close();
                throw new Error("ComfyUI Execution Error: " + JSON.stringify(history.status.messages));
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 5. Process and Upload Outputs
        const assetUrls: string[] = [];
        for (const nodeId of Object.keys(outputs)) {
            const nodeOutput = outputs[nodeId];
            if (nodeOutput.images) {
                for (const img of nodeOutput.images) {
                    const imgRes = await axios.get(`${COMFYUI_URL}/view`, {
                        params: { filename: img.filename, subfolder: img.subfolder, type: img.type },
                        responseType: 'arraybuffer'
                    });

                    const buffer = Buffer.from(imgRes.data);
                    const storagePath = `generations/${job.user_id}/${job.id}/${img.filename}`;

                    const { error: uploadError } = await supabase.storage
                        .from('assets')
                        .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath);
                    assetUrls.push(publicUrl);

                    // Create Asset record
                    await supabase
                        .from('assets')
                        .insert({
                            user_id: job.user_id,
                            job_id: job.id,
                            type: 'image',
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

// Polling interval
setInterval(pollForJobs, 1000);

pollForJobs();
