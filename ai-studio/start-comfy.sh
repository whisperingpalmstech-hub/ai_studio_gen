#!/bin/bash

# Configuration
COMFY_DIR="/media/sujeetnew/4TB HDD1/AiModels/ComfyUI"
VENV_PATH="$COMFY_DIR/venv"

echo "🚀 Starting ComfyUI..."

if [ ! -d "$VENV_PATH" ]; then
    echo "❌ Virtual environment not found. Please run installation first."
    exit 1
fi

# Activate venv and start
source "$VENV_PATH/bin/activate"
cd "$COMFY_DIR"
python3 main.py --listen 127.0.0.1 --port 8188
