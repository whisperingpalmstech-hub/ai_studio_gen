
export function generateSimpleWorkflow(params: any): Record<string, any> {
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
        SAVE_PREVIEW: "14" // Fallback preview node
    };

    const workflow: Record<string, any> = {};

    // Standard Image Generation (original logic moved into condition)
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

        workflow[ID_OLD.CHECKPOINT] = {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: params.model_id || "v1-5-pruned-emaonly.safetensors" }
        };

        workflow[ID_OLD.PROMPT_POS] = {
            class_type: "CLIPTextEncode",
            inputs: {
                text: params.prompt || "",
                clip: [ID_OLD.CHECKPOINT, 1]
            }
        };

        workflow[ID_OLD.PROMPT_NEG] = {
            class_type: "CLIPTextEncode",
            inputs: {
                text: params.negative_prompt || "",
                clip: [ID_OLD.CHECKPOINT, 1]
            }
        };

        workflow[ID_OLD.VAE_DECODE] = {
            class_type: "VAEDecode",
            inputs: {
                samples: [ID_OLD.SAMPLER, 0],
                vae: [ID_OLD.CHECKPOINT, 2]
            }
        };

        workflow[ID_OLD.SAVE_IMAGE] = {
            class_type: "SaveImage",
            inputs: {
                filename_prefix: "AiStudio",
                images: [ID_OLD.VAE_DECODE, 0]
            }
        };

        let latentNodeId = ID_OLD.LATENT_EMPTY;
        let denoise = 1.0;

        if (type === "txt2img") {
            workflow[ID_OLD.LATENT_EMPTY] = {
                class_type: "EmptyLatentImage",
                inputs: {
                    width: params.width || 512,
                    height: params.height || 512,
                    batch_size: 1
                }
            };
        } else if (type === "img2img" || type === "upscale") {
            if (!params.image_filename) throw new Error("Image filename required for input");
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename, upload: "image" }
            };

            let pixelNodeId = ID_OLD.LOAD_IMAGE;
            if (type === "upscale") {
                const UPSCALE_PIXELS = "15";
                workflow[UPSCALE_PIXELS] = {
                    class_type: "ImageScaleBy",
                    inputs: {
                        image: [ID_OLD.LOAD_IMAGE, 0],
                        upscale_method: "area",
                        scale_by: Number(params.upscale_factor) || 2.0
                    }
                };
                pixelNodeId = UPSCALE_PIXELS;
                denoise = params.denoising_strength ?? 0.35;
            } else {
                denoise = params.denoising_strength ?? 0.75;
            }

            workflow[ID_OLD.VAE_ENCODE] = {
                class_type: "VAEEncode",
                inputs: { pixels: [pixelNodeId, 0], vae: [ID_OLD.CHECKPOINT, 2] }
            };
            latentNodeId = ID_OLD.VAE_ENCODE;
        } else if (type === "inpaint") {
            if (!params.image_filename || !params.mask_filename) throw new Error("Image and mask required for inpaint");
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename, upload: "image" }
            };
            workflow[ID_OLD.LOAD_MASK] = {
                class_type: "LoadImage",
                inputs: { image: params.mask_filename, upload: "image" }
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
            denoise = params.denoising_strength ?? 0.9;
        }

        const SAMPLER_MAP: any = { "euler": "euler", "euler a": "euler_ancestral", "dpm++ 2m": "dpmpp_2m", "ddim": "ddim" };
        const rawSampler = (params.sampler || "euler").toLowerCase();
        const samplerName = SAMPLER_MAP[rawSampler] || "euler";
        const schedulerName = params.sampler?.toLowerCase().includes("karras") ? "karras" : "normal";

        workflow[ID_OLD.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID_OLD.CHECKPOINT, 0],
                positive: [ID_OLD.PROMPT_POS, 0],
                negative: [ID_OLD.PROMPT_NEG, 0],
                latent_image: [latentNodeId, 0],
                seed: Number(params.seed) && params.seed !== -1 ? Number(params.seed) : Math.floor(Math.random() * 10000000),
                steps: Number(params.steps) || 20,
                cfg: Number(params.cfg_scale) || 7.0,
                sampler_name: samplerName,
                scheduler: schedulerName,
                denoise: Number(denoise)
            }
        };
    }
    // Wan 2.1 Video Generation
    else if (type === "t2v" || type === "i2v") {
        // Enforce Wan models for video modes. Ignore regular SD checkpoints.
        let videoModel = params.model_id;
        if (!videoModel || !videoModel.toLowerCase().includes('wan')) {
            videoModel = (type === "t2v" ? "wan2.1_t2v_1.3B_bf16.safetensors" : "wan2.1_i2v_720p_14B_bf16.safetensors");
        }

        workflow[ID.CHECKPOINT] = {
            class_type: "UNETLoader",
            inputs: {
                unet_name: videoModel,
                weight_dtype: "default"
            }
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
            if (!params.image_filename) throw new Error("Image required for Image-to-Video");

            workflow[ID.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename, upload: "image" }
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
                seed: Number(params.seed) && params.seed !== -1 ? Number(params.seed) : Math.floor(Math.random() * 10000000),
                steps: Number(params.steps) || 30,
                cfg: Number(params.guidance_scale || params.cfg_scale) || 6.0,
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
                save_output: true,
                pingpong: false,
                save_metadata: true,
                trim_to_audio: false
            }
        };

        // Add a single frame preview as fallback/immediate result
        workflow[ID.SAVE_PREVIEW] = {
            class_type: "SaveImage",
            inputs: {
                filename_prefix: "AiStudio_Preview",
                images: [ID.VAE_DECODE, 0]
            }
        };
    }

    console.log("Final Generated Workflow Payload:", JSON.stringify(workflow, null, 2));
    return workflow;
}
