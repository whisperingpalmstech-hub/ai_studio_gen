#!/bin/bash

# Configuration
COMFY_DIR="/home/sujeetnew/Downloads/Ai-Studio/Ai-Studio-/ComfyUI"
SUPABASE_URL="https://zdpkjrbkgjflnqmdsxky.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcGtqcmJrZ2pmbG5xbWRzeGt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTUwMSwiZXhwIjoyMDg1ODU1NTAxfQ.t9bzLYUSEgzzJZiY1a0nPo4WjfPO6IM-c-OI6WdnYwA"

echo "🎨 Setting up AI Studio Models..."

# Create directories if they don't exist
mkdir -p "$COMFY_DIR/models/checkpoints"
mkdir -p "$COMFY_DIR/models/loras"
mkdir -p "$COMFY_DIR/models/controlnet"
mkdir -p "$COMFY_DIR/models/vae"
mkdir -p "$COMFY_DIR/models/clip_vision"

function register_model() {
    local name=$1
    local type=$2
    local filename=$3
    local base_model=$4

    echo "📝 Clean & Register $name ($type) in database..."
    
    # First, delete existing to avoid duplicates (using name + type as key)
    # We use name and type to uniquely identify system models in this script
    curl -X DELETE "${SUPABASE_URL}/rest/v1/models?name=eq.$(echo "$name" | sed 's/ /%20/g')&type=eq.$type" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}"

    # Register
    curl -X POST "${SUPABASE_URL}/rest/v1/models" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$name\", \"type\": \"$type\", \"file_path\": \"$filename\", \"base_model\": \"$base_model\", \"is_public\": true, \"is_system\": true}"
    
    echo ""
}

# 1. Download SD 1.5 Checkpoint
if [ ! -f "$COMFY_DIR/models/checkpoints/v1-5-pruned-emaonly.safetensors" ]; then
    echo "📥 Downloading SD 1.5..."
    wget -O "$COMFY_DIR/models/checkpoints/v1-5-pruned-emaonly.safetensors" "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"
fi
register_model "Stable Diffusion v1.5" "checkpoint" "v1-5-pruned-emaonly.safetensors" "sd15"

# 1.1. Download SDXL Base
if [ ! -f "$COMFY_DIR/models/checkpoints/sd_xl_base_1.0.safetensors" ]; then
    echo "📥 Downloading SDXL Base..."
    wget -O "$COMFY_DIR/models/checkpoints/sd_xl_base_1.0.safetensors" "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
fi
register_model "Stable Diffusion XL" "checkpoint" "sd_xl_base_1.0.safetensors" "sdxl"

# 2. Download SVD (Video)
if [ ! -f "$COMFY_DIR/models/checkpoints/svd.safetensors" ]; then
    echo "📥 Downloading SVD (Video)..."
    wget -O "$COMFY_DIR/models/checkpoints/svd.safetensors" "https://huggingface.co/stabilityai/stable-video-diffusion-img2vid/resolve/main/svd.safetensors"
fi
register_model "SVD Video" "checkpoint" "svd.safetensors" "other"

# 3. Download ControlNet Canny
if [ ! -f "$COMFY_DIR/models/controlnet/control_v11p_sd15_canny.pth" ]; then
    echo "📥 Downloading ControlNet Canny..."
    wget -O "$COMFY_DIR/models/controlnet/control_v11p_sd15_canny.pth" "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth"
fi
register_model "ControlNet Canny" "controlnet" "control_v11p_sd15_canny.pth" "sd15"

# 4. Download popular LoRA (Example: LCM for fast generation)
if [ ! -f "$COMFY_DIR/models/loras/lcm-lora-sdv1-5.safetensors" ]; then
    echo "📥 Downloading LCM LoRA..."
    wget -O "$COMFY_DIR/models/loras/lcm-lora-sdv1-5.safetensors" "https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors"
fi
register_model "LCM Fast Generation" "lora" "lcm-lora-sdv1-5.safetensors" "sd15"

# 5. Download CLIP Vision Model (Required for SVD/Wan)
if [ ! -f "$COMFY_DIR/models/clip_vision/clip_vision_h.safetensors" ]; then
    echo "📥 Downloading CLIP Vision H model..."
    wget -O "$COMFY_DIR/models/clip_vision/clip_vision_h.safetensors" "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision_h.safetensors"
fi

# 6. Wan 2.1 Dependencies
if [ ! -f "$COMFY_DIR/models/vae/wan_2.1_vae.safetensors" ]; then
    echo "📥 Downloading Wan 2.1 VAE..."
    wget -O "$COMFY_DIR/models/vae/wan_2.1_vae.safetensors" "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/wan_2.1_vae.safetensors"
fi

if [ ! -f "$COMFY_DIR/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" ]; then
    echo "📥 Downloading Wan 2.1 Text Encoder..."
    mkdir -p "$COMFY_DIR/models/text_encoders"
    wget -O "$COMFY_DIR/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"
fi

mkdir -p "$COMFY_DIR/models/diffusion_models"

if [ ! -f "$COMFY_DIR/models/diffusion_models/wan2.1_i2v_720p_14B_bf16.safetensors" ]; then
    echo "📥 Downloading Wan 2.1 I2V 720p 14B bf16 Model..."
    wget -O "$COMFY_DIR/models/diffusion_models/wan2.1_i2v_720p_14B_bf16.safetensors" "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_i2v_720p_14B_bf16.safetensors"
fi

if [ ! -f "$COMFY_DIR/models/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors" ]; then
    echo "📥 Downloading Wan 2.1 T2V 1.3B bf16 Model..."
    wget -O "$COMFY_DIR/models/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors" "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors"
fi

register_model "Wan 2.1 I2V 720p 14B bf16" "checkpoint" "wan2.1_i2v_720p_14B_bf16.safetensors" "other"
register_model "Wan 2.1 T2V 1.3B bf16" "checkpoint" "wan2.1_t2v_1.3B_bf16.safetensors" "other"

echo "✅ Model setup complete!"
echo "Note: SVD and Wan 2.1 are now available for your video workflows."
