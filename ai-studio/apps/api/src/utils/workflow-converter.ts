
interface ReactFlowNode {
    id: string;
    type: string;
    data: any;
}

interface ReactFlowEdge {
    source: string;
    target: string;
    sourceHandle?: string | null; // e.g. "model", "clip", "latent"
    targetHandle?: string | null;
}

interface ComfyINode {
    class_type: string;
    inputs: Record<string, any>;
}

export function convertReactFlowToComfyUI(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): Record<string, ComfyINode> {
    const comfyWorkflow: Record<string, ComfyINode> = {};

    // Map ReactFlow Node Types to ComfyUI Class Types
    // and map easy input values
    nodes.forEach(node => {
        let class_type = "";
        let inputs: Record<string, any> = {};

        switch (node.type) {
            case "loadModel":
                class_type = "CheckpointLoaderSimple";
                let ckptName = node.data.model || "v1-5-pruned-emaonly.ckpt";
                if (ckptName === "wan2.1_i2v_14B_720P.safetensors") ckptName = "wan2.1_i2v_720p_14B_bf16.safetensors";
                inputs["ckpt_name"] = ckptName;
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
                inputs["filename_prefix"] = "AiStudio";
                break;
            case "loadImage":
                class_type = "LoadImage";
                inputs["image"] = node.data.filename || "example.png";
                inputs["upload"] = "image";
                break;
            case "lora":
                class_type = "LoraLoader";
                inputs["lora_name"] = node.data.lora_name || "lcm-lora-sdv1-5.safetensors";
                inputs["strength_model"] = node.data.strength_model || 1.0;
                inputs["strength_clip"] = node.data.strength_clip || 1.0;
                break;
            case "controlNet": {
                const loaderId = `${node.id}_loader`;
                comfyWorkflow[loaderId] = {
                    class_type: "ControlNetLoader",
                    inputs: {
                        control_net_name: node.data.model || "control_v11p_sd15_canny.pth"
                    }
                };
                class_type = "ControlNetApply";
                inputs["strength"] = node.data.strength || 1.0;
                inputs["start_percent"] = 0.0;
                inputs["end_percent"] = 1.0;
                inputs["control_net"] = [loaderId, 0];
                break;
            }
            case "upscale":
                class_type = "ImageUpscaleWithModel";
                break;
            case "faceSwap":
                class_type = "ReActorFaceSwap";
                inputs["enabled"] = true;
                inputs["input_faces_order"] = "large-small";
                inputs["input_faces_index"] = "0";
                inputs["detect_gender_input"] = "no";
                inputs["detect_gender_source"] = "no";
                inputs["face_restore_model"] = "codeformer-v0.1.0.pth";
                inputs["face_restore_visibility"] = 1;
                inputs["codeformer_weight"] = 0.5;
                break;
            case "inpaint":
                class_type = "VAEEncodeForInpaint";
                inputs["grow_mask_by"] = node.data.blur || 6;
                break;
            case "latentUpscale":
                class_type = "LatentUpscale";
                inputs["upscale_method"] = node.data.upscale_method || "nearest-exact";
                inputs["width"] = node.data.width || 1024;
                inputs["height"] = node.data.height || 1024;
                inputs["crop"] = "disabled";
                break;
            case "conditioningAverage":
                class_type = "ConditioningAverage";
                inputs["conditioning_to_strength"] = node.data.strength || 0.5;
                break;
            case "svdLoader":
                class_type = "SVD_img2vid_Conditioning";
                inputs["video_frames"] = node.data.video_frames || 25;
                inputs["motion_bucket_id"] = node.data.motion_bucket_id || 127;
                inputs["fps"] = node.data.fps || 12;
                inputs["augmentation_level"] = node.data.augmentation_level || 0.0;
                inputs["width"] = node.data.width || 1024;
                inputs["height"] = node.data.height || 576;
                break;
            case "videoLinearCFG":
                class_type = "VideoLinearCFGGuidance";
                inputs["min_cfg"] = node.data.min_cfg || 1.0;
                break;
            case "clipVision":
                class_type = "CLIPVisionLoader";
                inputs["clip_name"] = node.data.model || "clip_vision_g.safetensors";
                break;
            case "videoCombine":
                class_type = "VHS_VideoCombine";
                inputs["frame_rate"] = node.data.fps || 12;
                inputs["loop_count"] = 0;
                inputs["filename_prefix"] = "AiStudio_Video";
                inputs["format"] = node.data.format || "video/h264-mp4";
                inputs["pix_fmt"] = "yuv420p";
                inputs["crf"] = 19;
                inputs["save_output"] = true;
                inputs["pingpong"] = false;
                inputs["save_metadata"] = true;
                inputs["trim_to_audio"] = false;
                break;
            case "clipVisionEncode":
                class_type = "CLIPVisionEncode";
                inputs["crop"] = "center"; // Native ComfyUI requires this in many versions
                break;

            // === Native ComfyUI Wan 2.1 Nodes ===
            case "unetLoader":
                class_type = "UNETLoader";
                let unetModel = node.data.model || "wan2.1_i2v_720p_14B_bf16.safetensors";
                // Redirect stale model name if it appears
                if (unetModel === "wan2.1_i2v_14B_720P.safetensors") {
                    unetModel = "wan2.1_i2v_720p_14B_bf16.safetensors";
                }
                inputs["unet_name"] = unetModel;
                inputs["weight_dtype"] = node.data.weight_dtype || "default";
                break;
            case "clipLoader":
                class_type = "CLIPLoader";
                inputs["clip_name"] = node.data.model || "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
                inputs["type"] = node.data.clip_type || "wan";
                break;
            case "vaeLoader":
                class_type = "VAELoader";
                inputs["vae_name"] = node.data.model || "wan_2.1_vae.safetensors";
                break;
            case "wanI2V":
                // Native ComfyUI WanImageToVideo node
                class_type = "WanImageToVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                inputs["batch_size"] = node.data.batch_size || 1;
                break;
            case "wanT2V":
                // Native Wan doesn't have a specific sampler, use standard KSampler
                class_type = "KSampler";
                inputs["seed"] = Math.floor(Math.random() * 1000000000);
                inputs["steps"] = node.data.steps || 30;
                inputs["cfg"] = node.data.cfg || 6.0;
                inputs["sampler_name"] = node.data.sampler || "uni_pc_bh2";
                inputs["scheduler"] = node.data.scheduler || "simple";
                inputs["denoise"] = 1.0;
                break;
            case "wanEmptyLatent":
                // Use the 16-channel video latent node from Hunyuan (identical to Wan's)
                class_type = "EmptyHunyuanLatentVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                inputs["batch_size"] = node.data.batch_size || 1;
                break;

            // === Legacy WanVideoWrapper nodes (kept for backward compat) ===
            case "wanModelLoader":
                class_type = "UNETLoader";
                let legacyModel = node.data.model || "wan2.1_i2v_720p_14B_bf16.safetensors";
                if (legacyModel === "wan2.1_i2v_14B_720P.safetensors") legacyModel = "wan2.1_i2v_720p_14B_bf16.safetensors";
                inputs["unet_name"] = legacyModel;
                inputs["weight_dtype"] = "default";
                break;
            case "wanVAELoader":
                class_type = "VAELoader";
                inputs["vae_name"] = node.data.model || "wan_2.1_vae.safetensors";
                break;
            case "wanT5Loader":
                class_type = "CLIPLoader";
                inputs["clip_name"] = node.data.model || "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
                inputs["type"] = "wan";
                break;
            case "wanTextEncode":
                class_type = "CLIPTextEncode";
                inputs["text"] = node.data.positive_prompt || node.data.prompt || "high quality video";
                break;
            case "wanLoader":
                class_type = "WanImageToVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                inputs["batch_size"] = 1;
                break;
            case "wanSampler":
                class_type = "KSampler";
                inputs["seed"] = node.data.seed || Math.floor(Math.random() * 10000000);
                inputs["steps"] = node.data.steps || 30;
                inputs["cfg"] = node.data.cfg || 6.0;
                inputs["sampler_name"] = node.data.sampler || "uni_pc_bh2";
                inputs["scheduler"] = node.data.scheduler || "simple";
                inputs["denoise"] = 1.0;
                break;
            case "wanDecode":
                class_type = "VAEDecode";
                break;

            default:
                console.warn(`Unknown node type: ${node.type}`);
                class_type = node.type;
                inputs = { ...node.data };
        }

        comfyWorkflow[node.id] = { class_type, inputs };
    });

    // Map Edges to Inputs
    edges.forEach(edge => {
        const targetNode = comfyWorkflow[edge.target];
        if (!targetNode) return;

        let inputName = edge.targetHandle || "";

        // Handle name normalization to ComfyUI standards
        const handleMap: Record<string, string> = {
            "latent_in": "latent_image",
            "clip_in": "clip",
            "model_in": "model",
            "conditioning_in": "conditioning",
            "image_in": "image",
            "image": "image",
            "pixels": "pixels",
            "vae": "vae",
            "samples": "samples",
            "mask": "mask",
            "face": "face_image",
            "clip_vision": "clip_vision",
            "init_image": "init_image",
            "images": "images",
            "start_image": "start_image",
            "t5": "clip",
            "image_embeds": "clip_vision_output",
            "text_embeds": "conditioning",
            "model": "model",
            "positive": "positive",
            "negative": "negative",
            "latent": "latent_image",
            "clip": "clip",
            "clip_vision_output": "clip_vision_output",
        };

        if (handleMap[inputName]) {
            inputName = handleMap[inputName];
        }

        // Specific override for VAE Decode which might use 'latents' or 'samples'
        if (targetNode.class_type === "VAEDecode" && inputName === "latent") {
            inputName = "samples";
        }

        if (inputName) {
            let outputIndex = 0;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceNodeType = sourceNode?.type;
            const sourceHandle = edge.sourceHandle;

            // Output index mappings
            if (sourceNodeType === "loadModel") {
                if (sourceHandle === "model") outputIndex = 0;
                else if (sourceHandle === "clip") outputIndex = 1;
                else if (sourceHandle === "vae") outputIndex = 2;
            } else if (sourceNodeType === "lora") {
                if (sourceHandle === "model_out") outputIndex = 0;
                else if (sourceHandle === "clip_out") outputIndex = 1;
            } else if (sourceNodeType === "sampler" && sourceHandle === "latent_out") {
                outputIndex = 0;
            } else if (sourceNodeType === "loadImage") {
                if (sourceHandle === "image") outputIndex = 0;
                else if (sourceHandle === "mask") outputIndex = 1;
            } else if (sourceNodeType === "latentUpscale" || sourceNodeType === "emptyLatent" || sourceNodeType === "vaeEncode" || sourceNodeType === "inpaint") {
                outputIndex = 0;
            } else if (sourceNodeType === "vaeDecode" || sourceNodeType === "upscale" || sourceNodeType === "faceSwap") {
                outputIndex = 0;
            } else if (sourceNodeType === "conditioningAverage" || sourceNodeType === "prompt") {
                outputIndex = 0;
            } else if (sourceNodeType === "svdLoader") {
                if (sourceHandle === "positive") outputIndex = 0;
                else if (sourceHandle === "negative") outputIndex = 1;
                else if (sourceHandle === "latent") outputIndex = 2;
            } else if (sourceNodeType === "videoLinearCFG") {
                outputIndex = 0;
            } else if (sourceNodeType === "clipVision") {
                outputIndex = 0;
            } else if (sourceNodeType === "clipVisionEncode") {
                outputIndex = 0; // CLIP_VISION_OUTPUT
                // === Native Wan Node Outputs ===
            } else if (sourceNodeType === "unetLoader" || sourceNodeType === "wanModelLoader") {
                outputIndex = 0; // MODEL
            } else if (sourceNodeType === "vaeLoader" || sourceNodeType === "wanVAELoader") {
                outputIndex = 0; // VAE
            } else if (sourceNodeType === "clipLoader" || sourceNodeType === "wanT5Loader") {
                outputIndex = 0; // CLIP
            } else if (sourceNodeType === "wanTextEncode") {
                outputIndex = 0; // CONDITIONING
            } else if (sourceNodeType === "wanI2V" || sourceNodeType === "wanLoader") {
                // WanImageToVideo outputs: [positive, negative, latent]
                if (sourceHandle === "positive") outputIndex = 0;
                else if (sourceHandle === "negative") outputIndex = 1;
                else if (sourceHandle === "latent") outputIndex = 2;
                else if (sourceHandle === "image_embeds") outputIndex = 2; // legacy handle name → latent
                else outputIndex = 2; // default to latent
            } else if (sourceNodeType === "wanSampler" || sourceNodeType === "wanT2V") {
                outputIndex = 0; // LATENT (it's a KSampler now)
            } else if (sourceNodeType === "wanEmptyLatent") {
                outputIndex = 0; // LATENT (EmptyHunyuanLatentVideo)
            } else if (sourceNodeType === "wanDecode") {
                outputIndex = 0; // IMAGE
            }

            targetNode.inputs[inputName] = [edge.source, outputIndex];
        }
    });

    return comfyWorkflow;
}
