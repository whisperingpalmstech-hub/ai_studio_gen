import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config/index.js";
import { supabaseAdmin } from "../services/supabase.js";
import { webSocketService } from "../services/websocket.js";

// Redis connection
const connection = new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
});

// Job queue
export const jobQueue = new Queue("ai-generation", {
    connection,
    defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    },
});

// Job data interface
interface GenerationJobData {
    jobId: string;
    userId: string;
    type: string;
    params: Record<string, unknown>;
}

// Job processor (this would communicate with GPU workers)
async function processJob(job: Job<GenerationJobData>) {
    const { jobId, userId, type, params } = job.data;
    const { comfyUIService } = await import("../services/comfyui.js");
    const { generateSimpleWorkflow } = await import("../utils/simple-workflow-generator.js");

    console.log(`Processing job ${jobId} of type ${type}`);

    let promptId: string | undefined;

    try {
        // Update job status to processing
        await ((supabaseAdmin as any)
            .from("jobs")
            .update({
                status: "processing",
                started_at: new Date().toISOString(),
            })
            .eq("id", jobId));

        let comfyPrompt: any;

        // 1. Construct ComfyUI Prompt based on type
        if (type === 'workflow') {
            try {
                const workflowData = (params as any).workflow;
                if (!workflowData || !workflowData.nodes || !workflowData.edges) {
                    throw new Error("Invalid workflow data: missing nodes or edges");
                }
                const { convertReactFlowToComfyUI } = await import("../utils/workflow-converter.js");
                comfyPrompt = convertReactFlowToComfyUI(workflowData.nodes, workflowData.edges);

                // Handle Image Uploads within Workflow Nodes
                for (const node of workflowData.nodes) {
                    if (node.type === 'loadImage' && node.data?.image?.startsWith('data:')) {
                        try {
                            const base64Data = node.data.image.split(",")[1];
                            const buffer = Buffer.from(base64Data, 'base64');
                            const filename = `wkf_${jobId}_${node.id}.png`;
                            const uploadedName = await comfyUIService.uploadImage(buffer, filename);

                            // Update the converted prompt with the actual uploaded filename
                            if (comfyPrompt[node.id]) {
                                comfyPrompt[node.id].inputs["image"] = uploadedName;
                                console.log(`Uploaded workflow image for node ${node.id}: ${uploadedName}`);
                            }
                        } catch (e) {
                            console.error(`Failed to upload image for node ${node.id}:`, e);
                        }
                    }
                }

                console.log("Generated ComfyUI Prompt for Workflow:", JSON.stringify(comfyPrompt, null, 2));
            } catch (err) {
                console.error("Failed to convert workflow:", err);
                throw new Error("Workflow conversion failed: " + (err instanceof Error ? err.message : String(err)));
            }
        } else {
            // Standard Generation (txt2img, img2img, etc.)

            // Handle Image Uploads for Img2Img / Inpaint
            if (params.image_url && typeof params.image_url === 'string' && params.image_url.startsWith('data:')) {
                try {
                    const base64Data = params.image_url.split(",")[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    // Upload to ComfyUI
                    // We need a unique filename
                    const filename = `input_${jobId}_image.png`;
                    const uploadedName = await comfyUIService.uploadImage(buffer, filename);
                    params.image_filename = uploadedName;
                    console.log(`Uploaded input image: ${uploadedName}`);
                } catch (e) {
                    console.error("Failed to upload input image:", e);
                    // Continue? Or fail?
                    // If it's img2img, we probably should fail.
                    if (type === 'img2img' || type === 'inpaint' || type === 'upscale') {
                        throw new Error("Failed to upload input image");
                    }
                }
            }

            if (params.mask_url && typeof params.mask_url === 'string' && params.mask_url.startsWith('data:')) {
                try {
                    const base64Data = params.mask_url.split(",")[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    const filename = `input_${jobId}_mask.png`;
                    const uploadedName = await comfyUIService.uploadImage(buffer, filename);
                    params.mask_filename = uploadedName;
                    console.log(`Uploaded mask image: ${uploadedName}`);
                } catch (e) {
                    console.error("Failed to upload mask:", e);
                    if (type === 'inpaint') {
                        throw new Error("Failed to upload mask image");
                    }
                }
            }

            comfyPrompt = generateSimpleWorkflow({ ...params, type });
            console.log(`Generated standard workflow for ${type}`);
        }

        const { comfyUIWebSocketService } = await import("../services/comfyui-ws.js");
        promptId = await comfyUIService.queuePrompt(comfyPrompt, comfyUIWebSocketService.clientId);
        comfyUIWebSocketService.registerPrompt(promptId, userId, jobId);
        console.log(`ComfyUI Prompt Queued: ${promptId}`);

        // 3. Poll for Completion (Polling every 1s)
        let isComplete = false;
        let outputs: any = {};
        let finalStatus = "processing";

        const startTime = Date.now();
        const timeout = 3600000; // 1 hour timeout (increased for video/slow GPUs)

        while (!isComplete) {
            if (Date.now() - startTime > timeout) {
                throw new Error("Job timed out");
            }

            try {
                const history = await comfyUIService.getHistory(promptId);

                // ComfyUI history is keyed by promptId (UUID)
                if (history && history[promptId]) {
                    const result = history[promptId];

                    if (result.status && result.status.completed) {
                        isComplete = true;
                        outputs = result.outputs;
                        finalStatus = "completed";
                    } else if (result.status && result.status.status_str === 'error') {
                        throw new Error(`ComfyUI Error: ${JSON.stringify(result.status)}`);
                    }
                }
            } catch (err) {
                // Ignore 404s or other fetch errors during polling?
                // If ComfyUI is down, we might want to fail eventually.
                console.warn(`Polling error for ${promptId}:`, err);
            }

            if (!isComplete) {
                // Wait 1 second before next poll
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 4. Process Outputs
        const nodeResults: Record<string, any[]> = {};
        const allProcessedImages: any[] = [];
        let hasFoundVideo = false;

        for (const nodeId of Object.keys(outputs)) {
            const nodeOutput = outputs[nodeId];
            const nodeInfo = (comfyPrompt as any)?.[nodeId];
            const nodeName = nodeInfo ? `${nodeInfo.class_type} (${nodeId})` : `Node ${nodeId}`;

            console.log(`Processing ${nodeName} output:`, JSON.stringify(nodeOutput));

            // Handle Videos/GIFs first
            const videoData = nodeOutput.gifs || nodeOutput.videos || nodeOutput.filenames || nodeOutput.video || nodeOutput.files;
            if (videoData) {
                console.log(`Found explicit video data in ${nodeName}`);
                if (!nodeResults[nodeId]) nodeResults[nodeId] = [];
                for (let vid of videoData) {
                    if (typeof vid === 'string') {
                        vid = { filename: vid, subfolder: '', type: 'output' };
                    }

                    if (vid.filename && (vid.filename.endsWith('.mp4') || vid.filename.endsWith('.webm') || vid.filename.endsWith('.gif') || vid.type === 'output')) {
                        try {
                            const buffer = await comfyUIService.getImage(vid.filename, vid.subfolder || '', vid.type || 'output');
                            const storagePath = `generations/${userId}/${jobId}/${vid.filename}`;
                            const contentType = vid.format || (vid.filename.endsWith('.gif') ? 'image/gif' : 'video/mp4');

                            await supabaseAdmin.storage.from('assets').upload(storagePath, buffer, { contentType, upsert: true });
                            const { data: { publicUrl } } = supabaseAdmin.storage.from('assets').getPublicUrl(storagePath);

                            const videoResult = {
                                filename: vid.filename,
                                url: publicUrl,
                                width: params.width || 832,
                                height: params.height || 480,
                                type: 'video'
                            };
                            nodeResults[nodeId].push(videoResult);
                            allProcessedImages.push(videoResult);
                            hasFoundVideo = true;
                        } catch (e) {
                            console.error(`Failed to process video output from ${nodeName}:`, e);
                        }
                    }
                }
            }

            // Handle Images
            const isVideoJob = (type === 't2v' || type === 'i2v');
            if (nodeOutput.images) {
                console.log(`Found ${nodeOutput.images.length} images in ${nodeName}`);

                // If we have a massive batch of images in a video job, it's likely frames
                if (isVideoJob && nodeOutput.images.length > 5 && !hasFoundVideo) {
                    console.warn(`Warning: ${nodeName} produced ${nodeOutput.images.length} frames but no final video was found. This might indicate a missing VideoHelperSuite node or an issue with video encoding.`);
                }

                for (const img of nodeOutput.images) {
                    // Check if extension is actually a video
                    if (img.filename && (img.filename.endsWith('.mp4') || img.filename.endsWith('.webm'))) {
                        try {
                            const buffer = await comfyUIService.getImage(img.filename, img.subfolder, img.type || 'output');
                            const storagePath = `generations/${userId}/${jobId}/${img.filename}`;
                            await supabaseAdmin.storage.from('assets').upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });
                            const { data: { publicUrl } } = supabaseAdmin.storage.from('assets').getPublicUrl(storagePath);

                            const videoResult = { filename: img.filename, url: publicUrl, width: params.width || 832, height: params.height || 480, type: 'video' };
                            if (!nodeResults[nodeId]) nodeResults[nodeId] = [];
                            nodeResults[nodeId].push(videoResult);
                            allProcessedImages.push(videoResult);
                            hasFoundVideo = true;
                        } catch (e) {
                            console.error(`Failed to process hidden video in ${nodeName}:`, e);
                        }
                        continue;
                    }

                    // Standard image handling
                    // Prioritize 'output' type.
                    if (img.type === 'output') {
                        try {
                            const buffer = await comfyUIService.getImage(img.filename, img.subfolder, img.type);
                            const storagePath = `generations/${userId}/${jobId}/${img.filename}`;
                            await supabaseAdmin.storage.from('assets').upload(storagePath, buffer, { contentType: 'image/png', upsert: true });
                            const { data: { publicUrl } } = supabaseAdmin.storage.from('assets').getPublicUrl(storagePath);

                            const imageResult = { filename: img.filename, url: publicUrl, width: params.width || 512, height: params.height || 512, type: 'image' };
                            if (!nodeResults[nodeId]) nodeResults[nodeId] = [];
                            nodeResults[nodeId].push(imageResult);
                            allProcessedImages.push(imageResult);
                        } catch (e) {
                            console.error(`Failed to process output image for ${nodeName}:`, e);
                        }
                    }
                }
            }
        }

        if (allProcessedImages.length === 0) {
            console.error(`Job Failed. Remaining History:`, JSON.stringify(outputs));
            throw new Error("No output generated from ComfyUI execution. Check if your video nodes are correctly installed.");
        }

        // 5. Save Assets to DB
        // Prioritize video for the main asset and for the first item in the images array
        const sortedImages = [...allProcessedImages].sort((a, b) => {
            if (a.type === 'video' && b.type !== 'video') return -1;
            if (a.type !== 'video' && b.type === 'video') return 1;
            return 0;
        });

        let asset: any = null;
        if (sortedImages.length > 0) {
            const primaryImage = sortedImages[0];
            const { data, error: assetError } = await (supabaseAdmin
                .from("assets")
                .insert({
                    user_id: userId,
                    job_id: jobId,
                    type: primaryImage.type || "image",
                    file_path: primaryImage.url,
                    width: primaryImage.width,
                    height: primaryImage.height,
                    params: params as any,
                    model_name: "wan-2-1",
                    prompt: params.prompt as string || "Workflow Results",
                    created_at: new Date().toISOString()
                } as any)
                .select()
                .single() as any);

            if (assetError) throw new Error("Asset creation failed: " + assetError.message);
            asset = data;

            // 6. Notify User
            webSocketService.sendToUser(userId, {
                type: "job_completed",
                jobId,
                images: sortedImages.map(img => img.url),
                asset: asset
            });
        }

        // 7. Update Job Status
        await ((supabaseAdmin as any)
            .from("jobs")
            .update({
                status: "completed",
                progress: 100,
                outputs: asset ? [asset.id] : [],
                completed_at: new Date().toISOString(),
            })
            .eq("id", jobId));

        console.log(`Job ${jobId} completed successfully`);
        comfyUIWebSocketService.unregisterPrompt(promptId);
        return { success: true, assetId: asset?.id };

    } catch (error: any) {
        console.error(`Job ${jobId} failed:`, error);

        webSocketService.sendToUser(userId, {
            type: "job_failed",
            jobId,
            status: "failed",
            error: error.message || "Unknown error",
        });

        // Update job as failed
        await ((supabaseAdmin as any)
            .from("jobs")
            .update({
                status: "failed",
                error_message: error.message || "Unknown error",
                completed_at: new Date().toISOString(),
            })
            .eq("id", jobId));

        if (promptId) {
            const { comfyUIWebSocketService } = await import("../services/comfyui-ws.js");
            comfyUIWebSocketService.unregisterPrompt(promptId);
        }
        throw error;
    }
}



// Create worker
export const jobWorker = new Worker("ai-generation", processJob, {
    connection,
    concurrency: 5,
});

// Worker event handlers
jobWorker.on("completed", (job: Job<GenerationJobData>) => {
    console.log(`Job ${job.id} has completed`);
});

jobWorker.on("failed", (job: Job<GenerationJobData> | undefined, err: Error) => {
    if (job) {
        console.error(`Job ${job.id} has failed:`, err);
    } else {
        console.error(`Job failed (undefined job):`, err);
    }
});

jobWorker.on("progress", (job: Job<GenerationJobData, any, string>, progress: any) => {
    // BullMQ progress is slightly loose in typing, so we can cast if needed or just use as is if compatible.
    console.log(`Job ${job.id} is ${JSON.stringify(progress)}% complete`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("Shutting down job queue...");
    await jobWorker.close();
    await jobQueue.close();
    connection.disconnect();
});

console.log("Job queue initialized");
