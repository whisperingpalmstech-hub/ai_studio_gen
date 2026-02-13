
export type WorkflowType =
    | "text_to_image"
    | "image_to_image"
    | "upscale"
    | "text_to_video"
    | "image_to_video"
    | "inpaint";

export interface ModelMetadata {
    id: string;
    name: string;
    type: "checkpoint" | "lora" | "upscaler" | "embedding" | "vae";
    compatibleWorkflows: WorkflowType[];
    architecture: "sd15" | "sdxl" | "flux" | "wan2.1" | "svd" | "esrgan" | "other";
    inputType: "text" | "text+image" | "image";
}

export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
    // SDXL Models
    "sd_xl_base_1.0.safetensors": {
        id: "sdxl_base",
        name: "SDXL Base 1.0",
        type: "checkpoint",
        compatibleWorkflows: ["text_to_image", "image_to_image", "inpaint"],
        architecture: "sdxl",
        inputType: "text+image"
    },
    "juggernautXL_ragnarokBy.safetensors": {
        id: "juggernaut_xl",
        name: "Juggernaut XL Ragnarok",
        type: "checkpoint",
        compatibleWorkflows: ["text_to_image", "image_to_image", "inpaint"],
        architecture: "sdxl",
        inputType: "text+image"
    },

    // SD 1.5 Models
    "v1-5-pruned-emaonly.safetensors": {
        id: "sd15_base",
        name: "Stable Diffusion 1.5",
        type: "checkpoint",
        compatibleWorkflows: ["text_to_image", "image_to_image"],
        architecture: "sd15",
        inputType: "text+image"
    },

    // Inpainting Models
    "realistic-vision-inpaint.safetensors": {
        id: "realistic_vision_inpaint",
        name: "Realistic Vision Inpaint",
        type: "checkpoint",
        compatibleWorkflows: ["inpaint"],
        architecture: "sd15",
        inputType: "text+image"
    },
    "sd-v1-5-inpainting.safetensors": {
        id: "sd15_inpaint",
        name: "SD 1.5 Inpainting",
        type: "checkpoint",
        compatibleWorkflows: ["inpaint"],
        architecture: "sd15",
        inputType: "text+image"
    },

    // Video Models (Wan 2.1)
    "wan2.1_t2v_1.3B_bf16.safetensors": {
        id: "wan2.1_t2v",
        name: "Wan 2.1 T2V (1.3B)",
        type: "checkpoint",
        compatibleWorkflows: ["text_to_video"],
        architecture: "wan2.1",
        inputType: "text"
    },
    "wan2.1_i2v_720p_14B_bf16.safetensors": {
        id: "wan2.1_i2v",
        name: "Wan 2.1 I2V (14B)",
        type: "checkpoint",
        compatibleWorkflows: ["image_to_video"],
        architecture: "wan2.1",
        inputType: "text+image"
    },

    // SVD Models
    "svd.safetensors": {
        id: "svd",
        name: "SVD",
        type: "checkpoint",
        compatibleWorkflows: ["image_to_video"],
        architecture: "svd",
        inputType: "image"
    },
    "svd_xt.safetensors": {
        id: "svd_xt",
        name: "SVD XT",
        type: "checkpoint",
        compatibleWorkflows: ["image_to_video"],
        architecture: "svd",
        inputType: "image"
    }
};

export function validateModelWorkflow(modelId: string, workflow: string): boolean {
    const model = MODEL_REGISTRY[modelId];
    if (!model) return true; // Flexible for unknown models

    const typeMap: Record<string, WorkflowType> = {
        "txt2img": "text_to_image",
        "img2img": "image_to_image",
        "upscale": "upscale",
        "t2v": "text_to_video",
        "i2v": "image_to_video",
        "inpaint": "inpaint"
    };

    const workflowType = typeMap[workflow];
    if (!workflowType) return false;

    return model.compatibleWorkflows.includes(workflowType);
}

export function validateCompatibilityFromMetadata(metadata: any, workflow: string): boolean {
    if (!metadata || !metadata.compatibleWorkflows) return true; // Flexible for missing metadata

    const typeMap: Record<string, WorkflowType> = {
        "txt2img": "text_to_image",
        "img2img": "image_to_image",
        "upscale": "upscale",
        "t2v": "text_to_video",
        "i2v": "image_to_video",
        "inpaint": "inpaint"
    };

    const workflowType = typeMap[workflow];
    if (!workflowType) return false;

    return metadata.compatibleWorkflows.includes(workflowType);
}
