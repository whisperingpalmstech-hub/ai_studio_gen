
import { WorkflowType } from "./model-registry.js";

export class WorkflowRouter {
    static buildGraph(type: string, params: any): Record<string, any> {
        console.log(`🏗️ Building dynamic graph for workflow: ${type}`);

        switch (type) {
            case "txt2img":
                return this.buildTxt2Img(params);
            case "img2img":
                return this.buildImg2Img(params);
            case "upscale":
                return this.buildUpscale(params);
            case "t2v":
                return this.buildTxt2Video(params);
            case "i2v":
                return this.buildImg2Video(params);
            case "inpaint":
                return this.buildInpaint(params);
            default:
                throw new Error(`Unsupported workflow type: ${type}`);
        }
    }

    private static buildTxt2Img(params: any): Record<string, any> {
        const ID = {
            CHECKPOINT: "1",
            PROMPT_POS: "2",
            PROMPT_NEG: "3",
            LATENT: "4",
            SAMPLER: "5",
            VAE_DECODE: "6",
            SAVE: "7"
        };

        return {
            [ID.CHECKPOINT]: {
                class_type: "CheckpointLoaderSimple",
                inputs: { ckpt_name: params.model_id || "sd_xl_base_1.0.safetensors" }
            },
            [ID.PROMPT_POS]: {
                class_type: "CLIPTextEncode",
                inputs: { text: params.prompt || "", clip: [ID.CHECKPOINT, 1] }
            },
            [ID.PROMPT_NEG]: {
                class_type: "CLIPTextEncode",
                inputs: { text: params.negative_prompt || "", clip: [ID.CHECKPOINT, 1] }
            },
            [ID.LATENT]: {
                class_type: "EmptyLatentImage",
                inputs: { width: params.width || 1024, height: params.height || 1024, batch_size: 1 }
            },
            [ID.SAMPLER]: {
                class_type: "KSampler",
                inputs: {
                    model: [ID.CHECKPOINT, 0],
                    positive: [ID.PROMPT_POS, 0],
                    negative: [ID.PROMPT_NEG, 0],
                    latent_image: [ID.LATENT, 0],
                    seed: Number(params.seed) === -1 ? Math.floor(Math.random() * 1000000) : Number(params.seed),
                    steps: Number(params.steps) || 20,
                    cfg: Number(params.cfg_scale) || 7.0,
                    sampler_name: "euler_a",
                    scheduler: "normal",
                    denoise: 1.0
                }
            },
            [ID.VAE_DECODE]: {
                class_type: "VAEDecode",
                inputs: { samples: [ID.SAMPLER, 0], vae: [ID.CHECKPOINT, 2] }
            },
            [ID.SAVE]: {
                class_type: "SaveImage",
                inputs: { filename_prefix: "AiStudio", images: [ID.VAE_DECODE, 0] }
            }
        };
    }

    private static buildImg2Img(params: any): Record<string, any> {
        const ID = {
            CHECKPOINT: "1",
            PROMPT_POS: "2",
            PROMPT_NEG: "3",
            LOAD_IMAGE: "10",
            VAE_ENCODE: "11",
            SAMPLER: "5",
            VAE_DECODE: "6",
            SAVE: "7"
        };

        return {
            [ID.CHECKPOINT]: {
                class_type: "CheckpointLoaderSimple",
                inputs: { ckpt_name: params.model_id || "sd_xl_base_1.0.safetensors" }
            },
            [ID.PROMPT_POS]: {
                class_type: "CLIPTextEncode",
                inputs: { text: params.prompt || "", clip: [ID.CHECKPOINT, 1] }
            },
            [ID.PROMPT_NEG]: {
                class_type: "CLIPTextEncode",
                inputs: { text: params.negative_prompt || "", clip: [ID.CHECKPOINT, 1] }
            },
            [ID.LOAD_IMAGE]: {
                class_type: "LoadImage",
                inputs: { image: params.image_filename || "input.png", upload: "image" }
            },
            [ID.VAE_ENCODE]: {
                class_type: "VAEEncode",
                inputs: { pixels: [ID.LOAD_IMAGE, 0], vae: [ID.CHECKPOINT, 2] }
            },
            [ID.SAMPLER]: {
                class_type: "KSampler",
                inputs: {
                    model: [ID.CHECKPOINT, 0],
                    positive: [ID.PROMPT_POS, 0],
                    negative: [ID.PROMPT_NEG, 0],
                    latent_image: [ID.VAE_ENCODE, 0],
                    seed: Number(params.seed) === -1 ? Math.floor(Math.random() * 1000000) : Number(params.seed),
                    steps: Number(params.steps) || 20,
                    cfg: Number(params.cfg_scale) || 7.0,
                    sampler_name: "euler_a",
                    scheduler: "normal",
                    denoise: Number(params.denoising_strength) || 0.75
                }
            },
            [ID.VAE_DECODE]: {
                class_type: "VAEDecode",
                inputs: { samples: [ID.SAMPLER, 0], vae: [ID.CHECKPOINT, 2] }
            },
            [ID.SAVE]: {
                class_type: "SaveImage",
                inputs: { filename_prefix: "AiStudio_I2I", images: [ID.VAE_DECODE, 0] }
            }
        };
    }

    private static buildTxt2Video(params: any): Record<string, any> {
        const ID = {
            MODEL: "1",
            VAE: "2",
            CLIP: "3",
            POS: "4",
            NEG: "5",
            LATENT: "6",
            SAMPLER: "7",
            DECODE: "8",
            COMBINE: "9"
        };

        return {
            [ID.MODEL]: { class_type: "UNETLoader", inputs: { unet_name: params.model_id || "wan2.1_t2v_1.3B_bf16.safetensors" } },
            [ID.VAE]: { class_type: "VAELoader", inputs: { vae_name: "wan_2.1_vae.safetensors" } },
            [ID.CLIP]: { class_type: "CLIPLoader", inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan" } },
            [ID.POS]: { class_type: "CLIPTextEncode", inputs: { text: params.prompt, clip: [ID.CLIP, 0] } },
            [ID.NEG]: { class_type: "CLIPTextEncode", inputs: { text: params.negative_prompt || "", clip: [ID.CLIP, 0] } },
            [ID.LATENT]: { class_type: "EmptyHunyuanLatentVideo", inputs: { width: params.width || 832, height: params.height || 480, length: params.video_frames || 81, batch_size: 1 } },
            [ID.SAMPLER]: {
                class_type: "KSampler",
                inputs: {
                    model: [ID.MODEL, 0],
                    positive: [ID.POS, 0],
                    negative: [ID.NEG, 0],
                    latent_image: [ID.LATENT, 0],
                    seed: params.seed === -1 ? Math.floor(Math.random() * 1000000) : params.seed,
                    steps: params.steps || 30,
                    cfg: params.cfg_scale || 6.0,
                    sampler_name: "uni_pc_bh2",
                    scheduler: "simple",
                    denoise: 1.0
                }
            },
            [ID.DECODE]: { class_type: "VAEDecode", inputs: { samples: [ID.SAMPLER, 0], vae: [ID.VAE, 0] } },
            [ID.COMBINE]: { class_type: "VHS_VideoCombine", inputs: { images: [ID.DECODE, 0], frame_rate: params.fps || 16, format: "video/h264-mp4" } }
        };
    }

    private static buildImg2Video(params: any): Record<string, any> {
        // Similar to buildTxt2Video but with WanImageToVideo node
        // Simplified for now
        return this.buildTxt2Video(params);
    }

    private static buildUpscale(params: any): Record<string, any> {
        // Upscale specific graph
        return {};
    }

    private static buildInpaint(params: any): Record<string, any> {
        // Inpaint specific graph
        return {};
    }
}
