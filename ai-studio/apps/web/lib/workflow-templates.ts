export const WORKFLOW_TEMPLATES = [
    {
        id: 'tpl-txt2img',
        name: 'Standard Text-to-Image',
        description: 'The foundation of AI art. Generate high-quality images from pure text descriptions.',
        category: 'Essentials',
        nodes: [
            { id: '1', type: 'loadModel', position: { x: 50, y: 50 }, data: { label: 'Load Checkpoint' } },
            { id: '2', type: 'prompt', position: { x: 400, y: 50 }, data: { label: 'Positive Prompt', prompt: 'a beautiful futuristic city, high detail, 8k' } },
            { id: '3', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Negative Prompt', prompt: 'blurry, distorted, low quality, text' } },
            { id: '4', type: 'emptyLatent', position: { x: 400, y: 450 }, data: { label: 'Empty Latent', width: 512, height: 512 } },
            { id: '5', type: 'sampler', position: { x: 750, y: 50 }, data: { label: 'KSampler', steps: 25, cfg: 7.5 } },
            { id: '6', type: 'vaeDecode', position: { x: 1050, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '7', type: 'output', position: { x: 1350, y: 50 }, data: { label: 'Save Image' } }
        ],
        edges: [
            { id: 'e1-5', source: '1', target: '5', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e1-2', source: '1', target: '2', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e1-3', source: '1', target: '3', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e2-5', source: '2', target: '5', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e3-5', source: '3', target: '5', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e4-5', source: '4', target: '5', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e5-6', source: '5', target: '6', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e1-6', source: '1', target: '6', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },
    {
        id: 'tpl-img2img',
        name: 'Creative Image-to-Image',
        description: 'Transform existing images into new styles while maintaining composition and structure.',
        category: 'Transformation',
        nodes: [
            { id: '1', type: 'loadModel', position: { x: 50, y: 50 }, data: { label: 'Load Checkpoint' } },
            { id: '2', type: 'prompt', position: { x: 400, y: 50 }, data: { label: 'Positive Prompt', prompt: 'oil painting style, vibrant colors' } },
            { id: '3', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Negative Prompt' } },
            { id: '4', type: 'loadImage', position: { x: 50, y: 350 }, data: { label: 'Load Image' } },
            { id: '5', type: 'vaeEncode', position: { x: 400, y: 450 }, data: { label: 'VAE Encode' } },
            { id: '6', type: 'sampler', position: { x: 750, y: 50 }, data: { label: 'KSampler', steps: 30, cfg: 8.0, denoise: 0.6 } },
            { id: '7', type: 'vaeDecode', position: { x: 1050, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '8', type: 'output', position: { x: 1350, y: 50 }, data: { label: 'Save Image' } }
        ],
        edges: [
            { id: 'e1-6', source: '1', target: '6', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e1-2', source: '1', target: '2', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e1-3', source: '1', target: '3', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e2-6', source: '2', target: '6', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e3-6', source: '3', target: '6', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e4-5', source: '4', target: '5', sourceHandle: 'image', targetHandle: 'pixels' },
            { id: 'e1-5', source: '1', target: '5', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e5-6', source: '5', target: '6', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e1-7', source: '1', target: '7', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e7-8', source: '7', target: '8', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },
    {
        id: 'tpl-lora',
        name: 'LoRA Style Integration',
        description: 'Inject specific styles or characters into your generations using specialized LoRA models.',
        category: 'Advanced',
        nodes: [
            { id: '1', type: 'loadModel', position: { x: 50, y: 50 }, data: { label: 'Load Checkpoint' } },
            { id: '2', type: 'lora', position: { x: 350, y: 50 }, data: { label: 'Load LoRA', strength_model: 1.0, strength_clip: 1.0 } },
            { id: '3', type: 'prompt', position: { x: 650, y: 50 }, data: { label: 'Positive Prompt' } },
            { id: '4', type: 'prompt', position: { x: 650, y: 250 }, data: { label: 'Negative Prompt' } },
            { id: '5', type: 'emptyLatent', position: { x: 650, y: 450 }, data: { label: 'Empty Latent' } },
            { id: '6', type: 'sampler', position: { x: 950, y: 50 }, data: { label: 'KSampler' } },
            { id: '7', type: 'vaeDecode', position: { x: 1250, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '8', type: 'output', position: { x: 1550, y: 50 }, data: { label: 'Save Image' } }
        ],
        edges: [
            { id: 'e1-2m', source: '1', target: '2', sourceHandle: 'model', targetHandle: 'model_in' },
            { id: 'e1-2c', source: '1', target: '2', sourceHandle: 'clip', targetHandle: 'clip_in' },
            { id: 'e2-6', source: '2', target: '6', sourceHandle: 'model_out', targetHandle: 'model' },
            { id: 'e2-3', source: '2', target: '3', sourceHandle: 'clip_out', targetHandle: 'clip' },
            { id: 'e2-4', source: '2', target: '4', sourceHandle: 'clip_out', targetHandle: 'clip' },
            { id: 'e3-6', source: '3', target: '6', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e4-6', source: '4', target: '6', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e5-6', source: '5', target: '6', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e1-7', source: '1', target: '7', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e7-8', source: '7', target: '8', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },
    {
        id: 'tpl-inpaint',
        name: 'Professional Inpainting',
        description: 'Edit specific parts of an image by masking them. Perfect for fixing details or changing objects.',
        category: 'Repair',
        nodes: [
            { id: '1', type: 'loadModel', position: { x: 50, y: 50 }, data: { label: 'Load Checkpoint', model: 'realistic-vision-inpaint.safetensors' } },
            { id: '2', type: 'prompt', position: { x: 400, y: 50 }, data: { label: 'Positive Prompt' } },
            { id: '3', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Negative Prompt' } },
            { id: '4', type: 'loadImage', position: { x: 50, y: 350 }, data: { label: 'Load Image & Mask' } },
            { id: '5', type: 'inpaint', position: { x: 400, y: 450 }, data: { label: 'Inpaint VAE' } },
            { id: '6', type: 'sampler', position: { x: 750, y: 50 }, data: { label: 'KSampler', denoise: 0.7 } },
            { id: '7', type: 'vaeDecode', position: { x: 1050, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '8', type: 'output', position: { x: 1350, y: 50 }, data: { label: 'Save Image' } }
        ],
        edges: [
            { id: 'e1-6', source: '1', target: '6', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e1-2', source: '1', target: '2', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e1-3', source: '1', target: '3', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e2-6', source: '2', target: '6', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e3-6', source: '3', target: '6', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e4-5p', source: '4', target: '5', sourceHandle: 'image', targetHandle: 'pixels' },
            { id: 'e4-5m', source: '4', target: '5', sourceHandle: 'mask', targetHandle: 'mask' },
            { id: 'e1-5', source: '1', target: '5', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e5-6', source: '5', target: '6', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e1-7', source: '1', target: '7', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e7-8', source: '7', target: '8', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },
    {
        id: 'tpl-controlnet',
        name: 'ControlNet Edge Detection',
        description: 'Guided generation using structural constraints like Canny edges or Depth maps.',
        category: 'Transformation',
        nodes: [
            { id: '1', type: 'loadModel', position: { x: 50, y: 50 }, data: { label: 'Load Checkpoint' } },
            { id: '2', type: 'prompt', position: { x: 700, y: 50 }, data: { label: 'Positive Prompt' } },
            { id: '3', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Negative Prompt' } },
            { id: '4', type: 'loadImage', position: { x: 50, y: 350 }, data: { label: 'Load Control Image' } },
            { id: '5', type: 'controlNet', position: { x: 400, y: 50 }, data: { label: 'Apply ControlNet', strength: 1.0 } },
            { id: '6', type: 'emptyLatent', position: { x: 700, y: 450 }, data: { label: 'Empty Latent' } },
            { id: '7', type: 'sampler', position: { x: 1000, y: 50 }, data: { label: 'KSampler' } },
            { id: '8', type: 'vaeDecode', position: { x: 1300, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '9', type: 'output', position: { x: 1600, y: 50 }, data: { label: 'Save Image' } }
        ],
        edges: [
            { id: 'e1-7', source: '1', target: '7', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e1-2', source: '1', target: '2', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e2-5', source: '2', target: '5', sourceHandle: 'conditioning', targetHandle: 'conditioning_in' },
            { id: 'e5-7', source: '5', target: '7', sourceHandle: 'conditioning_out', targetHandle: 'positive' },
            { id: 'e4-5', source: '4', target: '5', sourceHandle: 'image', targetHandle: 'image' },
            { id: 'e1-3', source: '1', target: '3', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e3-7', source: '3', target: '7', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e7-8l', source: '7', target: '8', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e1-8', source: '1', target: '8', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e8-9', source: '8', target: '9', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },

    {
        id: 'tpl-wan-i2v',
        name: 'Wan 2.1 Image-to-Video',
        description: 'Transform a static image into a high-quality video using Wan 2.1.',
        category: 'Wan 2.1',
        nodes: [
            { id: '1', type: 'unetLoader', position: { x: 50, y: 50 }, data: { label: 'Wan 2.1 Model', model: 'wan2.1_i2v_720p_14B_bf16.safetensors' } },
            { id: '2', type: 'vaeLoader', position: { x: 50, y: 200 }, data: { label: 'Wan VAE', model: 'wan_2.1_vae.safetensors' } },
            { id: '3', type: 'clipLoader', position: { x: 50, y: 350 }, data: { label: 'T5 Encoder', model: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors' } },
            { id: '4', type: 'clipVision', position: { x: 50, y: 500 }, data: { label: 'CLIP Vision', model: 'clip_vision_h.safetensors' } },
            { id: '5', type: 'loadImage', position: { x: 400, y: 50 }, data: { label: 'Input Image' } },
            { id: '6', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Positive Prompt', prompt: 'cinematic motion, slow camera pan' } },
            { id: '7', type: 'prompt', position: { x: 400, y: 450 }, data: { label: 'Negative Prompt', prompt: 'distorted, low quality' } },
            { id: '8', type: 'clipVisionEncode', position: { x: 400, y: 650 }, data: { label: 'CLIP Vision Encode' } },
            { id: '9', type: 'wanI2V', position: { x: 750, y: 50 }, data: { label: 'Wan I2V', video_frames: 81, width: 832, height: 480 } },
            { id: '10', type: 'sampler', position: { x: 1100, y: 50 }, data: { label: 'KSampler', steps: 30, cfg: 6.0, sampler: 'uni_pc_bh2', scheduler: 'simple' } },
            { id: '11', type: 'vaeDecode', position: { x: 1450, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '12', type: 'videoCombine', position: { x: 1800, y: 50 }, data: { label: 'Save Video', fps: 16 } }
        ],
        edges: [
            { id: 'e3-6', source: '3', target: '6', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e3-7', source: '3', target: '7', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e4-8', source: '4', target: '8', sourceHandle: 'clip_vision', targetHandle: 'clip_vision' },
            { id: 'e5-8', source: '5', target: '8', sourceHandle: 'image', targetHandle: 'image' },
            { id: 'e6-9', source: '6', target: '9', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e7-9', source: '7', target: '9', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e2-9', source: '2', target: '9', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e5-9', source: '5', target: '9', sourceHandle: 'image', targetHandle: 'start_image' },
            { id: 'e8-9', source: '8', target: '9', sourceHandle: 'clip_vision_output', targetHandle: 'clip_vision_output' },
            { id: 'e1-10', source: '1', target: '10', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e9-10p', source: '9', target: '10', sourceHandle: 'positive', targetHandle: 'positive' },
            { id: 'e9-10n', source: '9', target: '10', sourceHandle: 'negative', targetHandle: 'negative' },
            { id: 'e9-10l', source: '9', target: '10', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e10-11', source: '10', target: '11', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e2-11', source: '2', target: '11', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e11-12', source: '11', target: '12', sourceHandle: 'image', targetHandle: 'images' }
        ]
    },
    {
        id: 'tpl-wan-t2v',
        name: 'Wan 2.1 Text-to-Video',
        description: 'Generate videos from text descriptions using Wan 2.1.',
        category: 'Wan 2.1',
        nodes: [
            { id: '1', type: 'unetLoader', position: { x: 50, y: 50 }, data: { label: 'Wan 2.1 Model', model: 'wan2.1_t2v_1.3B_bf16.safetensors' } },
            { id: '2', type: 'vaeLoader', position: { x: 50, y: 200 }, data: { label: 'Wan VAE', model: 'wan_2.1_vae.safetensors' } },
            { id: '3', type: 'clipLoader', position: { x: 50, y: 350 }, data: { label: 'T5 Encoder', model: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors' } },
            { id: '4', type: 'prompt', position: { x: 400, y: 50 }, data: { label: 'Positive Prompt', prompt: 'a cat running in a field, cinematic' } },
            { id: '5', type: 'prompt', position: { x: 400, y: 250 }, data: { label: 'Negative Prompt', prompt: 'distorted, low quality' } },
            { id: '6', type: 'wanEmptyLatent', position: { x: 400, y: 450 }, data: { label: 'Wan Latent', width: 832, height: 480, video_frames: 81 } },
            { id: '7', type: 'sampler', position: { x: 750, y: 50 }, data: { label: 'KSampler', steps: 30, cfg: 6.0, sampler: 'uni_pc_bh2', scheduler: 'simple' } },
            { id: '8', type: 'vaeDecode', position: { x: 1050, y: 50 }, data: { label: 'VAE Decode' } },
            { id: '9', type: 'videoCombine', position: { x: 1350, y: 50 }, data: { label: 'Save Video', fps: 16 } }
        ],
        edges: [
            { id: 'e1-7', source: '1', target: '7', sourceHandle: 'model', targetHandle: 'model' },
            { id: 'e3-4', source: '3', target: '4', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e3-5', source: '3', target: '5', sourceHandle: 'clip', targetHandle: 'clip' },
            { id: 'e4-7', source: '4', target: '7', sourceHandle: 'conditioning', targetHandle: 'positive' },
            { id: 'e5-7', source: '5', target: '7', sourceHandle: 'conditioning', targetHandle: 'negative' },
            { id: 'e6-7', source: '6', target: '7', sourceHandle: 'latent', targetHandle: 'latent_in' },
            { id: 'e7-8', source: '7', target: '8', sourceHandle: 'latent_out', targetHandle: 'samples' },
            { id: 'e2-8', source: '2', target: '8', sourceHandle: 'vae', targetHandle: 'vae' },
            { id: 'e8-9', source: '8', target: '9', sourceHandle: 'image', targetHandle: 'images' }
        ]
    }
];
