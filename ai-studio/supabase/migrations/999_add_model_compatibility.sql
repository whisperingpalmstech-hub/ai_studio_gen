
-- Update metadata for common models to include compatibility info based on actual file paths

-- SDXL Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["text_to_image", "image_to_image", "inpaint"], "architecture": "sdxl", "inputType": "text+image"}'::jsonb
WHERE file_path IN ('sd_xl_base_1.0.safetensors', 'juggernautXL_ragnarokBy.safetensors');

-- SD 1.5 Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["text_to_image", "image_to_image"], "architecture": "sd15", "inputType": "text+image"}'::jsonb
WHERE file_path IN ('v1-5-pruned-emaonly.safetensors');

-- Inpainting Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["inpaint"], "architecture": "sd15", "inputType": "text+image"}'::jsonb
WHERE file_path IN ('realistic-vision-inpaint.safetensors', 'sd-v1-5-inpainting.safetensors');

-- Wan Video Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["text_to_video"], "architecture": "wan2.1", "inputType": "text"}'::jsonb
WHERE file_path = 'wan2.1_t2v_1.3B_bf16.safetensors';

UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["image_to_video"], "architecture": "wan2.1", "inputType": "text+image"}'::jsonb
WHERE file_path = 'wan2.1_i2v_720p_14B_bf16.safetensors';

-- SVD Video Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["image_to_video"], "architecture": "svd", "inputType": "image"}'::jsonb
WHERE file_path IN ('svd.safetensors', 'svd_xt.safetensors');

-- Upscale Models
UPDATE public.models
SET metadata = metadata || '{"compatibleWorkflows": ["upscale"], "architecture": "esrgan", "inputType": "image"}'::jsonb
WHERE type = 'upscaler';
