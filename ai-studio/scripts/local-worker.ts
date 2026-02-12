
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
    const { type, prompt, negative_prompt, width, height, steps, cfg_scale, seed, sampler, model_id } = params;

    // Map sampler names to ComfyUI internal names
    const samplerMap: Record<string, string> = {
        "Euler a": "euler_ancestral",
        "euler_a": "euler_ancestral",
        "Euler": "euler",
        "LMS": "lms",
        "Heun": "heun",
        "DPM2": "dpm_2",
        "DPM2 a": "dpm_2_ancestral",
        "DPM++ 2S a": "dpmpp_2s_ancestral",
        "DPM++ 2M": "dpmpp_2m",
        "DPM++ SDE": "dpmpp_sde",
        "DPM++ 2M SDE": "dpmpp_2m_sde",
        "DDIM": "ddim",
        "UniPC": "uni_pc"
    };

    const comfySampler = samplerMap[sampler] || "euler";
    const ckptName = model_id || "sd_xl_base_1.0.safetensors";

    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "cfg": cfg_scale || 7.5,
                "denoise": 1,
                "latent_image": ["5", 0],
                "model": ["4", 0],
                "negative": ["7", 0],
                "positive": ["6", 0],
                "sampler_name": comfySampler,
                "scheduler": "normal",
                "seed": seed || Math.floor(Math.random() * 1000000),
                "steps": steps || 20
            }
        },
        "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": ckptName } },
        "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": height || 1024, "width": width || 1024 } },
        "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": prompt } },
        "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": negative_prompt || "" } },
        "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
        "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "AiStudio", "images": ["8", 0] } }
    };
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

        // Setup WebSocket for progress
        const wsUrl = COMFYUI_URL.replace(/^http/, 'ws') + `/ws?clientId=${clientId}`;
        const ws = new WebSocket(wsUrl);

        ws.on('message', async (data: any) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'progress') {
                    const progress = Math.round((message.data.value / message.data.max) * 100);
                    const status_message = `Generating... ${progress}%`;
                    console.log(`⏳ Job ${job.id} progress: ${progress}%`);
                    await supabase.from('jobs').update({
                        progress,
                        status_message,
                        current_node: 'KSampler'
                    }).eq('id', job.id);
                } else if (message.type === 'executing' && message.data.node) {
                    const status_message = `Executing node: ${message.data.node}`;
                    await supabase.from('jobs').update({
                        status_message,
                        current_node: message.data.node
                    }).eq('id', job.id);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        let promptId;
        try {
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
setInterval(pollForJobs, 3000);

pollForJobs();
