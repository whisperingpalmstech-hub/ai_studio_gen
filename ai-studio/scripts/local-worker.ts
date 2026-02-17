
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: 'apps/api/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

// Enterprise Grade: Absolute path to ComfyUI input folder
const COMFYUI_INPUT_DIR = '/home/sujeetnew/Downloads/Ai-Studio/Ai-Studio-/ComfyUI/input';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("🚀 Starting Local AI Worker (v2 - Fixed Schema)...");
console.log(`📍 Supabase: ${SUPABASE_URL}`);
console.log(`📍 ComfyUI: ${COMFYUI_URL}`);
console.log(`📍 ComfyUI Input: ${COMFYUI_INPUT_DIR}`);

const STUCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// ========== SMART INPAINT PROMPT ANALYZER (v2 — Universal) ==========
// Handles ALL possible user scenarios: clothing, face, hair, background,
// accessories, shoes, tattoos, makeup, body mods, color-only changes,
// remove/add actions, and multi-region combinations.
// Helper to strip instructional keywords from prompt (SDXL prefers descriptions, not commands)
function cleanPrompt(text: string): string {
    let p = text.toLowerCase();
    const cleanups = [
        /^change\s+(?:the\s+)?/i,
        /^make\s+(?:the\s+)?/i,
        /^add\s+(?:a\s+|an\s+)?/i,
        /^remove\s+(?:the\s+)?/i,
        /^replace\s+(?:the\s+)?/i,
        /^wear(?:ing)?\s+(?:a\s+|an\s+)?/i,
        /^put\s+on\s+(?:a\s+|an\s+)?/i,
        /\s+to\s+(?:a\s+|an\s+)?/i,
        /\s+on\s+(?:the\s+)?persona/i,
        /\s+for\s+(?:the\s+)?person/i,
    ];
    let cleaned = text;
    // We want to keep the core nouns but remove the "Change to" prefix
    if (p.startsWith('change ') || p.startsWith('make ') || p.startsWith('add ') || p.startsWith('replace ')) {
        const parts = text.split(/\s+to\s+/i);
        if (parts.length > 1) {
            // "change my shirt to a red dress" -> "red dress"
            cleaned = parts[parts.length - 1];
        } else {
            // "change dress" -> "dress"
            cleaned = text.replace(/^(change|make|add|replace|remove)\s+(?:the\s+|a\s+|an\s+)?/i, '');
        }
    }
    return cleaned.trim();
}

interface InpaintAnalysis {
    dinoPrompt: string;       // What GroundingDINO should detect in the image
    denoise: number;          // Auto-tuned denoise strength
    dinoThreshold: number;    // DINO confidence threshold
    maskDilation: number;     // How much to expand the mask
    negativeAdditions: string; // Auto-added negative prompt terms
    changeType: string;       // For logging (comma-separated if multiple)
}

function analyzeInpaintPrompt(userPrompt: string, userNegative: string = ''): InpaintAnalysis {
    const prompt = userPrompt.toLowerCase();

    // ============ COMPREHENSIVE KEYWORD MAPS ============
    // CRITICAL: GroundingDINO works with SIMPLE NOUNS only!
    // "person", "clothes", "shirt", "face" = GOOD
    // "upper body clothing", "torso clothing" = BAD (DINO can't detect these)
    const REGIONS: Record<string, {
        keywords: string[];
        dinoParts: string[];
        denoise: number;
        threshold: number;
        dilation: number;
        negatives: string;
    }> = {
        upper_clothing: {
            keywords: ['shirt', 't-shirt', 'tshirt', 'blouse', 'top', 'sweater', 'hoodie', 'jacket', 'coat',
                'vest', 'kurta', 'polo', 'tank top', 'crop top', 'cardigan', 'blazer', 'sweatshirt',
                'jersey', 'tunic', 'pullover', 'windbreaker', 'parka', 'fleece'],
            dinoParts: ['person', 'clothes'],
            denoise: 0.45,
            threshold: 0.15,
            dilation: 8,
            negatives: 'wrong neckline, mismatched sleeves'
        },
        lower_clothing: {
            keywords: ['jeans', 'pants', 'trousers', 'shorts', 'skirt', 'leggings', 'salwar', 'pajama',
                'chinos', 'joggers', 'cargo pants', 'culottes', 'palazzo', 'flares', 'capri',
                'bermuda', 'sweatpants', 'track pants', 'dhoti'],
            dinoParts: ['person', 'clothes'],
            denoise: 0.45,
            threshold: 0.15,
            dilation: 8,
            negatives: 'wrong leg shape'
        },
        full_clothing: {
            keywords: ['dress', 'saree', 'sari', 'gown', 'jumpsuit', 'romper', 'lehenga', 'suit', 'outfit',
                'clothes', 'clothing', 'wear', 'attire', 'garment', 'western', 'traditional',
                'casual', 'formal', 'modern', 'ethnic', 'uniform', 'costume', 'apparel',
                'wardrobe', 'frock', 'anarkali', 'churidar', 'sharara', 'ghagra', 'kaftan',
                'abaya', 'kimono', 'hanbok', 'overalls', 'bodysuit', 'onesie'],
            dinoParts: ['clothes', 'clothing', 'garment', 'outfit'],
            denoise: 0.5,
            threshold: 0.15,
            dilation: 10,
            negatives: 'previous clothing visible, mixed outfit styles, old garment showing'
        },
        shoes: {
            keywords: ['shoes', 'sneakers', 'boots', 'heels', 'sandals', 'slippers', 'loafers', 'flats',
                'stilettos', 'wedges', 'moccasins', 'oxfords', 'pumps', 'flip flops', 'crocs',
                'trainers', 'footwear', 'chappal', 'juttis', 'kolhapuri'],
            dinoParts: ['shoes', 'feet'],
            denoise: 0.55,
            threshold: 0.2,
            dilation: 15,
            negatives: 'mismatched shoes, floating feet'
        },
        face: {
            keywords: ['face', 'expression', 'smile', 'frown', 'eyes', 'nose', 'lips', 'cheeks',
                'complexion', 'skin tone', 'freckles', 'wrinkles', 'beard', 'mustache',
                'moustache', 'clean shaven', 'goatee', 'sideburns', 'eyebrows', 'forehead',
                'chin', 'jaw', 'dimples', 'look older', 'look younger', 'aging', 'youthful'],
            dinoParts: ['face'],
            denoise: 0.45,
            threshold: 0.25,
            dilation: 10,
            negatives: 'different person, changed identity, distorted face, asymmetric face, unnatural skin'
        },
        makeup: {
            keywords: ['makeup', 'lipstick', 'eyeliner', 'eyeshadow', 'mascara', 'foundation',
                'blush', 'bronzer', 'highlighter', 'contour', 'gloss', 'cosmetic',
                'no makeup', 'natural look', 'glam', 'bridal makeup', 'party makeup'],
            dinoParts: ['face'],
            denoise: 0.4,
            threshold: 0.25,
            dilation: 8,
            negatives: 'smeared makeup, uneven skin, unnatural colors on face'
        },
        hair: {
            keywords: ['hair', 'hairstyle', 'haircut', 'bald', 'blonde', 'brunette', 'redhead',
                'curly', 'straight', 'wavy', 'ponytail', 'bun', 'braids', 'dreadlocks',
                'afro', 'bob', 'pixie', 'bangs', 'fringe', 'highlights', 'ombre',
                'hair color', 'hair length', 'long hair', 'short hair', 'mohawk',
                'undercut', 'fade', 'crew cut', 'cornrows', 'pigtails', 'updo'],
            dinoParts: ['hair', 'head'],
            denoise: 0.55,
            threshold: 0.2,
            dilation: 15,
            negatives: 'bald patches, uneven hair, hair artifacts, wig-like'
        },
        background: {
            keywords: ['background', 'scenery', 'room', 'outdoor', 'indoor', 'garden', 'beach',
                'city', 'studio', 'wall', 'setting', 'location', 'environment', 'scene',
                'landscape', 'sky', 'forest', 'mountain', 'ocean', 'sunset', 'sunrise',
                'night', 'park', 'street', 'office', 'home', 'cafe', 'restaurant',
                'palace', 'temple', 'church', 'library', 'gym', 'pool', 'space',
                'mars', 'moon', 'underwater', 'snow', 'rain', 'desert', 'jungle',
                'field', 'meadow', 'river', 'lake', 'waterfall', 'bridge', 'rooftop',
                'balcony', 'terrace', 'corridor', 'hallway', 'staircase'],
            dinoParts: ['wall', 'background', 'floor'],
            denoise: 0.75,
            threshold: 0.15,
            dilation: 30,
            negatives: 'person changed, different face, different body, body deformed'
        },
        accessories: {
            keywords: ['glasses', 'sunglasses', 'spectacles', 'jewelry', 'jewellery', 'necklace',
                'earring', 'earrings', 'watch', 'hat', 'cap', 'bindi', 'bangles',
                'scarf', 'dupatta', 'tie', 'bow tie', 'belt', 'bag', 'purse', 'handbag',
                'backpack', 'bracelet', 'ring', 'pendant', 'chain', 'choker', 'anklet',
                'headband', 'tiara', 'crown', 'veil', 'turban', 'pagri', 'stole',
                'shawl', 'gloves', 'mittens', 'umbrella', 'cane', 'walking stick',
                'headphones', 'airpods', 'mask', 'face mask'],
            dinoParts: ['glasses', 'jewelry', 'hat', 'necklace'],
            denoise: 0.5,
            threshold: 0.2,
            dilation: 12,
            negatives: 'floating accessories, misplaced items, wrong size'
        },
        tattoo: {
            keywords: ['tattoo', 'tattoos', 'body art', 'ink', 'henna', 'mehndi', 'mehendi',
                'body paint', 'face paint', 'tribal', 'sleeve tattoo'],
            dinoParts: ['arm', 'skin', 'body'],
            denoise: 0.45,
            threshold: 0.2,
            dilation: 10,
            negatives: 'blurred lines, smeared ink, unnatural skin texture'
        },
        body: {
            keywords: ['muscular', 'slim', 'thin', 'fat', 'athletic', 'toned', 'buff', 'skinny',
                'bulky', 'lean', 'fit', 'body shape', 'physique', 'body type', 'arms',
                'biceps', 'abs', 'chest', 'shoulders', 'neck', 'hands', 'fingers',
                'pregnant', 'belly'],
            dinoParts: ['person', 'body'],
            denoise: 0.55,
            threshold: 0.15,
            dilation: 20,
            negatives: 'extra limbs, wrong proportions, distorted body, unnatural pose'
        },
        object_in_hand: {
            keywords: ['holding', 'carry', 'carrying', 'phone', 'mobile', 'cup', 'coffee',
                'book', 'flower', 'flowers', 'bouquet', 'sword', 'weapon', 'guitar',
                'camera', 'bottle', 'glass', 'wine', 'food', 'plate', 'trophy',
                'ball', 'bat', 'racket', 'flag', 'sign', 'placard', 'paper',
                'pen', 'laptop', 'tablet', 'controller', 'microphone', 'candle',
                'gift', 'present', 'baby', 'child', 'cat', 'dog', 'pet',
                'briefcase', 'suitcase', 'luggage'],
            dinoParts: ['hand', 'object'],
            denoise: 0.55,
            threshold: 0.2,
            dilation: 15,
            negatives: 'floating object, wrong grip, extra fingers, fused object'
        }
    };

    // ============ DETECT ALL MATCHING REGIONS ============
    const matchedRegions: string[] = [];
    let allDinoParts: string[] = [];
    let maxDenoise = 0;
    let maxDilation = 0;
    let minThreshold = 1.0;
    let allNegatives: string[] = ['bad anatomy, deformed, distorted, disfigured, extra limbs, blurry, artifacts, low quality'];

    for (const [regionName, config] of Object.entries(REGIONS)) {
        // Basic match
        const hasKeyword = config.keywords.some(k => prompt.includes(k));

        // Smart Negative Constraint: "don't change face", "keep original eyes", etc.
        const isNegated = new RegExp(`(don't|do not|never|avoid|keep|original|don t|prevent)\\s+(?:change|changing|touch|modify|edit)?\\s+(?:the\\s+)?(?:${config.keywords.join('|')})`, 'i').test(prompt);

        if (hasKeyword && !isNegated) {
            matchedRegions.push(regionName);
            allDinoParts.push(...config.dinoParts);
            maxDenoise = Math.max(maxDenoise, config.denoise);
            maxDilation = Math.max(maxDilation, config.dilation);
            minThreshold = Math.min(minThreshold, config.threshold);
            allNegatives.push(config.negatives);
        } else if (isNegated) {
            console.log(`🛡️ Negative constraint detected for ${regionName} - protecting region.`);
        }
    }

    // ============ SPECIAL PATTERN DETECTION ============

    // "Remove X" / "without X" / "no X" patterns — mask the item to remove
    const removePatterns = [
        /remov(?:e|ing)\s+(?:the\s+)?(\w+)/,
        /without\s+(?:the\s+)?(\w+)/,
        /no\s+(\w+)/,
        /take\s+off\s+(?:the\s+)?(\w+)/,
        /get\s+rid\s+of\s+(?:the\s+)?(\w+)/
    ];
    for (const pattern of removePatterns) {
        const match = prompt.match(pattern);
        if (match) {
            const item = match[1];
            // Map the item to remove to a DINO detection term
            allDinoParts.push(item);
            if (!matchedRegions.includes('remove_item')) {
                matchedRegions.push('remove_item');
                maxDenoise = Math.max(maxDenoise, 0.6);
                maxDilation = Math.max(maxDilation, 15);
            }
        }
    }

    // "Change color" / "make it red" / "turn blue" patterns
    const colorPatterns = [
        /(?:change|make|turn|paint|dye|color|colour)\s+(?:it\s+|to\s+)?(?:the\s+)?(red|blue|green|yellow|pink|purple|white|black|brown|orange|grey|gray|golden|silver|navy|maroon|teal|cyan|magenta|beige|cream|ivory|lavender|turquoise|coral|salmon|olive|burgundy|indigo|violet|emerald|rose|peach|mint)/,
    ];
    for (const pattern of colorPatterns) {
        const match = prompt.match(pattern);
        if (match && matchedRegions.length === 0) {
            // Color-only change with no specific region → default to clothes
            matchedRegions.push('color_change');
            allDinoParts.push('clothes', 'outfit', 'clothing');
            maxDenoise = Math.max(maxDenoise, 0.55);
            maxDilation = Math.max(maxDilation, 20);
        }
    }

    // "From X to Y" patterns — very common! "change shirt to dress"
    const fromToPattern = /change\s+(?:the\s+)?(\w+)\s+to\s+(?:a\s+|an\s+)?(.+)/i;
    const fromToMatch = userPrompt.match(fromToPattern);
    if (fromToMatch) {
        const oldItem = fromToMatch[1];
        const newItem = fromToMatch[2];
        console.log(`🔄 From/To pattern: ${oldItem} -> ${newItem}`);
        allDinoParts.push(oldItem); // Detect the OLD item to mask it
        allNegatives.push(oldItem); // Add OLD item to negative to remove traces
        if (!matchedRegions.includes('swap_item')) matchedRegions.push('swap_item');
    }

    // "Add X" patterns  
    const addPatterns = [
        /add\s+(?:a\s+|an\s+)?(\w+)/,
        /put\s+(?:on\s+)?(?:a\s+|an\s+)?(\w+)/,
        /wear(?:ing)?\s+(?:a\s+|an\s+)?(\w+)/,
        /give\s+(?:her|him|them)\s+(?:a\s+|an\s+)?(\w+)/
    ];
    for (const pattern of addPatterns) {
        const match = prompt.match(pattern);
        if (match && matchedRegions.length === 0) {
            const item = match[1];
            // Try to figure out what region the added item belongs to  
            allDinoParts.push(item, 'person');
            matchedRegions.push('add_item');
            maxDenoise = Math.max(maxDenoise, 0.55);
            maxDilation = Math.max(maxDilation, 15);
        }
    }

    // ============ CALCULATE FINAL VALUES ============

    // If nothing matched at all → smart fallback
    if (matchedRegions.length === 0) {
        console.log('⚠️ No specific region detected in prompt, defaulting to person/clothing detection');
        allDinoParts = ['person', 'clothes'];
        maxDenoise = 0.6;
        maxDilation = 22;
        minThreshold = 0.15;
        matchedRegions.push('general_detection');
    }

    // Multi-region adjustments
    if (matchedRegions.length > 1) {
        // Multiple regions changing → slightly higher denoise for coherence
        maxDenoise = Math.min(maxDenoise + 0.05, 0.8);
        // Larger dilation for smoother blending between regions
        maxDilation = Math.min(maxDilation + 5, 35);
        console.log(`🔀 Multi-region change detected: ${matchedRegions.join(' + ')}`);
    }

    // Deduplicate DINO parts
    const uniqueDinoParts = Array.from(new Set(allDinoParts));
    // Limit to 6 for best DINO performance
    const finalDinoParts = uniqueDinoParts.slice(0, 6);

    // Build DINO prompt with " . " separator (GroundingDINO standard)
    const dinoPrompt = finalDinoParts.join(' . ');
    const changeType = matchedRegions.join('+');
    const negativeAdditions = Array.from(new Set(allNegatives)).join(', ');

    console.log(`🧠 Smart Prompt Analysis (v2):`);
    console.log(`   User Prompt: "${userPrompt.substring(0, 80)}${userPrompt.length > 80 ? '...' : ''}"`);
    console.log(`   Matched Regions: [${matchedRegions.join(', ')}]`);
    console.log(`   DINO Prompt: "${dinoPrompt}"`);
    console.log(`   Denoise: ${maxDenoise}`);
    console.log(`   DINO Threshold: ${minThreshold}`);
    console.log(`   Mask Dilation: ${maxDilation}px`);

    return {
        dinoPrompt,
        denoise: maxDenoise,
        dinoThreshold: minThreshold,
        maskDilation: maxDilation,
        negativeAdditions,
        changeType
    };
}
// ========== END SMART ANALYZER (v2) ==========

async function uploadImageToComfy(dataUrl: string, filename: string) {
    try {
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) return;
        const buffer = Buffer.from(base64Data, 'base64');

        // 1. Save to ComfyUI input directory immediately (FOR ENTERPRISE RELIABILITY)
        const fullPath = path.join(COMFYUI_INPUT_DIR, filename);
        fs.writeFileSync(fullPath, buffer);
        console.log(`💾 Saved file to persistent storage: ${fullPath} (${buffer.length} bytes)`);

        // 2. Also upload via API (Double-safe)
        const form = new FormData();
        form.append('image', buffer, { filename, contentType: 'image/png' });
        form.append('overwrite', 'true');

        await axios.post(`${COMFYUI_URL}/upload/image`, form, {
            headers: form.getHeaders()
        });
        console.log(`📤 Notified ComfyUI API of upload: ${filename}`);

        // 3. Verify existence before proceeding
        if (!fs.existsSync(fullPath)) {
            throw new Error(`CRITICAL: Image file ${filename} not found in ComfyUI input folder after save attempt`);
        }
    } catch (err: any) {
        console.error(`❌ FAILED to prepare image: ${err.message}`);
        throw err; // Propagate to job failure
    }
}

// Import the workflow generator logic (Simplified for the script)

// === ReactFlow to ComfyUI Converter (Enterprise Grade) ===
interface ReactFlowNode {
    id: string;
    type: string;
    data: any;
}

interface ReactFlowEdge {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

interface ComfyINode {
    class_type: string;
    inputs: Record<string, any>;
}

async function syncWorkflowAssets(nodes: ReactFlowNode[]) {
    for (const node of nodes) {
        if (node.type === 'loadImage') {
            // Handle image base64
            if (node.data.image && node.data.image.startsWith('data:image')) {
                const filename = `wf_img_${node.id}_${Date.now()}.png`;
                console.log(`📡 Workflow Sync: Uploading node ${node.id} image...`);
                await uploadImageToComfy(node.data.image, filename);
                node.data.image = filename; // Replace with filename for ComfyUI
                node.data.filename = filename;
            }
            // Handle mask base64
            if (node.data.mask && node.data.mask.startsWith('data:image')) {
                const maskFilename = `wf_mask_${node.id}_${Date.now()}.png`;
                console.log(`📡 Workflow Sync: Uploading node ${node.id} mask...`);
                await uploadImageToComfy(node.data.mask, maskFilename);
                node.data.mask_filename = maskFilename; // Store for lookup
            }
        }
    }
}

function convertReactFlowToComfyUI(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): Record<string, ComfyINode> {
    const comfyWorkflow: Record<string, ComfyINode> = {};

    nodes.forEach(node => {
        let class_type = "";
        let inputs: Record<string, any> = {};

        console.log(`Node mapping: [${node.id}] type=${node.type}`);

        switch (node.type) {
            case "loadModel":
                class_type = "CheckpointLoaderSimple";
                inputs["ckpt_name"] = node.data.model || "sd_xl_base_1.0.safetensors";
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
                inputs["sampler_name"] = node.data.sampler || node.data.sampler_name || "euler";
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
            case "inpaint":
                class_type = "VAEEncodeForInpaint";
                inputs["grow_mask_by"] = 6;
                break;
            case "output":
                class_type = "SaveImage";
                inputs["filename_prefix"] = "AiStudio_WF";
                break;
            case "loadImage": {
                class_type = "LoadImage";
                inputs["image"] = node.data.filename || "example.png";
                inputs["upload"] = "image";

                // If this node has a mask attached, we can create a virtual node for it
                if (node.data.mask_filename) {
                    const maskLoaderId = `${node.id}_mask_loader`;
                    const maskConverterId = `${node.id}_mask_converter`;
                    comfyWorkflow[maskLoaderId] = {
                        class_type: "LoadImage",
                        inputs: { image: node.data.mask_filename, upload: "image" }
                    };
                    comfyWorkflow[maskConverterId] = {
                        class_type: "ImageToMask",
                        inputs: { image: [maskLoaderId, 0], channel: "red" }
                    };
                }
                break;
            }
            case "lora":
                class_type = "LoraLoader";
                inputs["lora_name"] = node.data.lora_name || "";
                inputs["strength_model"] = node.data.strength_model || 1.0;
                inputs["strength_clip"] = node.data.strength_clip || 1.0;
                break;
            case "controlNet": {
                const loaderId = `${node.id}_loader`;
                comfyWorkflow[loaderId] = {
                    class_type: "ControlNetLoader",
                    inputs: { control_net_name: node.data.model || "" }
                };
                class_type = "ControlNetApply";
                inputs["strength"] = node.data.strength || 1.0;
                inputs["control_net"] = [loaderId, 0];
                break;
            }
            case "videoCombine":
                class_type = "VHS_VideoCombine";
                inputs["frame_rate"] = node.data.fps || 16;
                inputs["loop_count"] = 0;
                inputs["filename_prefix"] = "AiStudio_WF_Video";
                inputs["format"] = "video/h264-mp4";
                inputs["pix_fmt"] = "yuv420p";
                inputs["crf"] = 19;
                inputs["save_output"] = true;
                break;

            // Wan 2.1 Native Node Support
            case "unetLoader":
                class_type = "UNETLoader";
                inputs["unet_name"] = node.data.model || "wan2.1_t2v_1.3B_bf16.safetensors";
                inputs["weight_dtype"] = "default";
                break;
            case "clipLoader":
                class_type = "CLIPLoader";
                inputs["clip_name"] = node.data.model || "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
                inputs["type"] = "wan";
                break;
            case "vaeLoader":
                class_type = "VAELoader";
                inputs["vae_name"] = node.data.model || "wan_2.1_vae.safetensors";
                break;
            case "clipVision":
                class_type = "CLIPVisionLoader";
                inputs["clip_name"] = node.data.model || "clip_vision_h.safetensors";
                break;
            case "clipVisionEncode":
                class_type = "CLIPVisionEncode";
                inputs["crop"] = "center";
                break;
            case "wanI2V":
                class_type = "WanImageToVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                break;
            case "wanT2V":
                class_type = "KSampler";
                inputs["seed"] = node.data.seed || Math.floor(Math.random() * 10000000);
                inputs["steps"] = node.data.steps || 30;
                inputs["cfg"] = node.data.cfg || 6.0;
                inputs["sampler_name"] = "uni_pc_bh2";
                inputs["scheduler"] = "simple";
                inputs["denoise"] = 1.0;
                break;
            case "wanEmptyLatent":
                class_type = "EmptyHunyuanLatentVideo";
                inputs["width"] = node.data.width || 832;
                inputs["height"] = node.data.height || 480;
                inputs["length"] = node.data.video_frames || 81;
                inputs["batch_size"] = 1;
                break;

            // === Auto-Masking (Segment Anything) ===
            case "groundingDinoLoader":
                class_type = "GroundingDinoModelLoader (segment anything)";
                inputs["model_name"] = node.data.model || "GroundingDINO_SwinT_OGC (694MB)";
                break;
            case "samModelLoader":
                class_type = "SAMModelLoader (segment anything)";
                inputs["model_name"] = node.data.model || "sam_vit_h (2.56GB)";
                break;
            case "groundingDinoSAMSegment":
                class_type = "GroundingDinoSAMSegment (segment anything)";
                inputs["prompt"] = node.data.prompt || "";
                inputs["threshold"] = node.data.threshold || 0.3;
                break;
            case "maskRefine": {
                // Grow 6px, Blur 2px as requested
                const dilateId = `${node.id}_dilate`;
                comfyWorkflow[dilateId] = {
                    class_type: "ImpactDilateMask",
                    inputs: {
                        mask: undefined, // assigned in edge loop
                        dilation: node.data.grow ?? 6
                    }
                };
                class_type = "ImpactGaussianBlurMask";
                inputs["mask"] = [dilateId, 0];
                inputs["kernel_size"] = node.data.blur ?? 2;
                inputs["sigma"] = 1.0;
                break;
            }
            case "inpaintConditioning":
                class_type = "InpaintModelConditioning";
                inputs["noise_mask"] = node.data.noise_mask !== false;
                break;

            default:
                class_type = node.type;
                inputs = { ...node.data };
        }

        comfyWorkflow[node.id] = { class_type, inputs };
    });

    edges.forEach(edge => {
        let targetId = edge.target;
        let targetNode = comfyWorkflow[targetId];
        if (!targetNode) return;

        // Redirect to dilation node for maskRefine inputs
        if (nodes.find(n => n.id === edge.target)?.type === "maskRefine") {
            targetId = `${edge.target}_dilate`;
            targetNode = comfyWorkflow[targetId];
        }

        let inputName = edge.targetHandle || "";
        const handleMap: Record<string, string> = {
            "latent_in": "latent_image", "clip_in": "clip", "model_in": "model",
            "conditioning_in": "conditioning", "image_in": "image", "pixels": "pixels",
            "vae": "vae", "samples": "samples", "mask": "mask", "clip_vision": "clip_vision",
            "images": "images", "start_image": "start_image", "model": "model",
            "positive": "positive", "negative": "negative", "latent": "latent_image",
            "vae_in": "vae",
            "dino_model": "grounding_dino_model", "sam_model": "sam_model",
            "mask_in": "mask", "vae_out": "vae"
        };
        if (handleMap[inputName]) inputName = handleMap[inputName];

        // Node-specific input name overrides: convert 'image' handle to 'pixels' only for nodes that need it
        if (inputName === "image") {
            const pixelNodes = ["InpaintModelConditioning", "VAEEncodeForInpaint", "VAEEncode"];
            if (pixelNodes.includes(targetNode.class_type)) {
                inputName = "pixels";
            }
        }
        if (targetNode.class_type === "InpaintModelConditioning" && inputName === "mask_in") inputName = "mask";
        if (targetNode.class_type === "VAEDecode" && inputName === "latent") inputName = "samples";

        if (inputName) {
            let outputIndex = 0;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceHandle = edge.sourceHandle;

            if (sourceNode?.type === "loadModel") {
                if (sourceHandle === "model") outputIndex = 0;
                else if (sourceHandle === "clip") outputIndex = 1;
                else if (sourceHandle === "vae") outputIndex = 2;
            } else if (sourceNode?.type === "lora") {
                if (sourceHandle === "model_out") outputIndex = 0;
                else if (sourceHandle === "clip_out") outputIndex = 1;
            } else if (sourceNode?.type === "wanI2V" || sourceNode?.type === "wanLoader") {
                if (sourceHandle === "positive") outputIndex = 0;
                else if (sourceHandle === "negative") outputIndex = 1;
                else outputIndex = 2;
            } else if (sourceNode?.type === "loadImage") {
                if (sourceHandle === "mask" && sourceNode.data.mask_filename) {
                    // Redirect to the auxiliary converter node we created in the node loop
                    targetNode.inputs[inputName] = [`${edge.source}_mask_converter`, 0];
                    return; // Early return for this edge
                } else if (sourceHandle === "mask") {
                    outputIndex = 1;
                } else {
                    outputIndex = 0;
                }
            } else if (sourceNode?.type === "groundingDinoLoader" || sourceNode?.type === "samModelLoader") {
                outputIndex = 0;
            } else if (sourceNode?.type === "groundingDinoSAMSegment") {
                if (sourceHandle === "image_out") outputIndex = 0;
                else outputIndex = 1; // mask
            } else if (sourceNode?.type === "maskRefine") {
                outputIndex = 0;
            } else if (sourceNode?.type === "inpaintConditioning") {
                if (sourceHandle === "cond_pos") outputIndex = 0;
                else if (sourceHandle === "cond_neg") outputIndex = 1;
                else outputIndex = 2; // latent
            }
            // Add other index mappings as needed, but default 0 works for most

            targetNode.inputs[inputName] = [edge.source, outputIndex];

            // Debug: log InpaintModelConditioning and KSampler edge wiring
            if (targetNode.class_type === "InpaintModelConditioning" || targetNode.class_type === "KSampler") {
                console.log(`🔗 Edge Wiring: ${edge.source}(${sourceNode?.type})[${sourceHandle}] → ${targetId}(${targetNode.class_type})[${inputName}] = [${edge.source}, ${outputIndex}]`);
            }
        }
    });

    // Final verification: log InpaintModelConditioning inputs if present
    for (const [nodeId, node] of Object.entries(comfyWorkflow)) {
        if (node.class_type === "InpaintModelConditioning") {
            console.log(`\n✅ InpaintModelConditioning [${nodeId}] final inputs:`);
            console.log(`   positive: ${JSON.stringify(node.inputs.positive)}`);
            console.log(`   negative: ${JSON.stringify(node.inputs.negative)}`);
            console.log(`   vae: ${JSON.stringify(node.inputs.vae)}`);
            console.log(`   pixels: ${JSON.stringify(node.inputs.pixels)}`);
            console.log(`   mask: ${JSON.stringify(node.inputs.mask)}`);
        }
        if (node.class_type === "KSampler") {
            console.log(`\n✅ KSampler [${nodeId}] final inputs:`);
            console.log(`   model: ${JSON.stringify(node.inputs.model)}`);
            console.log(`   positive: ${JSON.stringify(node.inputs.positive)}`);
            console.log(`   negative: ${JSON.stringify(node.inputs.negative)}`);
            console.log(`   latent_image: ${JSON.stringify(node.inputs.latent_image)}`);
        }
    }

    return comfyWorkflow;
}

const generateSimpleWorkflow = (params: any) => {
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
        SAVE_PREVIEW: "14"
    };

    const workflow: Record<string, any> = {};
    let denoise = 1.0;

    // Standard Image Generation
    console.log(`🛠️ Generating workflow for type: ${type}`);
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

        const ckptName = params.model_id || "sd_xl_base_1.0.safetensors";

        workflow[ID_OLD.CHECKPOINT] = {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: ckptName }
        };

        workflow[ID_OLD.PROMPT_POS] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.prompt || "", clip: [ID_OLD.CHECKPOINT, 1] }
        };

        workflow[ID_OLD.PROMPT_NEG] = {
            class_type: "CLIPTextEncode",
            inputs: { text: params.negative_prompt || "", clip: [ID_OLD.CHECKPOINT, 1] }
        };

        workflow[ID_OLD.VAE_DECODE] = {
            class_type: "VAEDecode",
            inputs: { samples: [ID_OLD.SAMPLER, 0], vae: [ID_OLD.CHECKPOINT, 2] }
        };

        workflow[ID_OLD.SAVE_IMAGE] = {
            class_type: "SaveImage",
            inputs: { filename_prefix: "AiStudio", images: [ID_OLD.VAE_DECODE, 0] }
        };

        let latentNodeId = ID_OLD.LATENT_EMPTY;
        denoise = 1.0;

        if (type === "txt2img") {
            workflow[ID_OLD.LATENT_EMPTY] = {
                class_type: "EmptyLatentImage",
                inputs: {
                    width: params.width || 1024,
                    height: params.height || 1024,
                    batch_size: 1
                }
            };
        } else if (type === "img2img" || type === "upscale") {
            const sourceImage = params.image_filename || "input.png";
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: sourceImage, upload: "image" }
            };

            let pixelNodeId = ID_OLD.LOAD_IMAGE;
            denoise = params.denoising_strength ?? (type === "upscale" ? 0.35 : 0.75);

            if (type === "upscale") {
                const UPSCALE_NODE = "15";
                workflow[UPSCALE_NODE] = {
                    class_type: "ImageScaleBy",
                    inputs: {
                        image: [ID_OLD.LOAD_IMAGE, 0],
                        upscale_method: "area",
                        scale_by: 2.0
                    }
                };
                pixelNodeId = UPSCALE_NODE;
            }

            workflow[ID_OLD.VAE_ENCODE] = {
                class_type: "VAEEncode",
                inputs: { pixels: [pixelNodeId, 0], vae: [ID_OLD.CHECKPOINT, 2] }
            };
            latentNodeId = ID_OLD.VAE_ENCODE;
        } else if (type === "inpaint") {
            workflow[ID_OLD.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename || "input.png", upload: "image" }
            };
            workflow[ID_OLD.LOAD_MASK] = {
                class_type: "LoadImage",
                inputs: { image: params.mask_filename || "mask.png", upload: "image" }
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
            denoise = params.denoising_strength ?? 0.6;
        }

        const samplerMap: Record<string, string> = {
            "Euler a": "euler_ancestral",
            "euler_a": "euler_ancestral",
            "Euler": "euler",
            "DPM++ 2M": "dpmpp_2m",
            "UniPC": "uni_pc"
        };
        const comfySampler = samplerMap[params.sampler] || "euler";

        workflow[ID_OLD.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID_OLD.CHECKPOINT, 0],
                positive: [ID_OLD.PROMPT_POS, 0],
                negative: [ID_OLD.PROMPT_NEG, 0],
                latent_image: [latentNodeId, 0],
                seed: params.seed && params.seed !== -1 ? params.seed : Math.floor(Math.random() * 10000000),
                steps: params.steps || 20,
                cfg: params.cfg_scale || 7.0,
                sampler_name: comfySampler,
                scheduler: "normal",
                denoise: denoise
            }
        };
    }
    // Wan 2.1 Video Generation
    else if (type === "t2v" || type === "i2v") {
        let videoModel = params.model_id;
        if (!videoModel || !videoModel.toLowerCase().includes('wan')) {
            videoModel = (type === "t2v" ? "wan2.1_t2v_1.3B_bf16.safetensors" : "wan2.1_i2v_720p_14B_bf16.safetensors");
        }

        workflow[ID.CHECKPOINT] = {
            class_type: "UNETLoader",
            inputs: { unet_name: videoModel, weight_dtype: "default" }
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
            workflow[ID.LOAD_IMAGE] = {
                class_type: "LoadImage",
                inputs: { image: params.image_filename || "input.png", upload: "image" }
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
                seed: params.seed && params.seed !== -1 ? Number(params.seed) : Math.floor(Math.random() * 10000000),
                steps: Number(params.steps) || 30,
                cfg: Number(params.cfg_scale) || 6.0,
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
                save_output: true
            }
        };

        // Single frame preview
        workflow[ID.SAVE_PREVIEW] = {
            class_type: "SaveImage",
            inputs: {
                filename_prefix: "AiStudio_Preview",
                images: [ID.VAE_DECODE, 0]
            }
        };
    }
    // Auto-Inpaint: GroundingDINO + SAM auto-masking (Smart Automation)
    else if (type === "auto_inpaint") {
        // === USE SMART ANALYZER to extract DINO prompt from user's natural language ===
        const analysis = analyzeInpaintPrompt(params.prompt || '', params.negative_prompt || '');
        const dinoPrompt = params._dino_prompt_override || analysis.dinoPrompt;
        // CRITICAL: Always use the smart analyzer's denoise — the frontend slider (0.75)
        // is way too high for inpainting and WILL regenerate the person's face.
        // For clothing-only changes, 0.4-0.55 preserves identity while changing textures.
        const autoDenoise = Math.min(analysis.denoise, 0.45);
        const autoThreshold = analysis.dinoThreshold;
        const autoMaskDilation = analysis.maskDilation;

        // Auto-enhance negative prompt
        let enhancedNegative = params.negative_prompt || '';
        // Always add identity-preservation terms
        const identityProtection = 'different person, changed identity, changed face, changed skin color, changed body, different ethnicity, wrong skin tone';
        if (!enhancedNegative || enhancedNegative.trim().length < 10) {
            enhancedNegative = identityProtection + ', ' + analysis.negativeAdditions;
        } else {
            // Append smart additions + identity protection
            enhancedNegative = enhancedNegative + ', ' + identityProtection + ', ' + analysis.negativeAdditions;
        }

        console.log(`🎭 Building SMART auto-inpaint workflow:`);
        console.log(`   User Prompt: "${params.prompt}"`);
        console.log(`   DINO Detection: "${dinoPrompt}"`);
        console.log(`   Denoise: ${autoDenoise}`);
        console.log(`   DINO Threshold: ${autoThreshold}`);
        console.log(`   Mask Dilation: ${autoMaskDilation}px`);
        console.log(`   Enhanced Negative: "${enhancedNegative.substring(0, 80)}..."`);

        const ID_AI = {
            CHECKPOINT: "1",
            PROMPT_POS: "2",
            PROMPT_NEG: "3",
            LOAD_IMAGE: "4",
            DINO_LOADER: "5",
            SAM_LOADER: "6",
            DINO_SAM_SEGMENT: "7",
            DILATE_MASK: "8",
            BLUR_MASK: "9",
            VAE_ENCODE: "10",
            SET_LATENT_MASK: "14",
            SAMPLER: "11",
            VAE_DECODE: "12",
            SAVE_IMAGE: "13"
        };

        // Use user's selected model, fallback to SDXL base
        const ckptName = params.model_id || "sd_xl_base_1.0.safetensors";
        const samplerMap: Record<string, string> = {
            "Euler a": "euler_ancestral",
            "euler_a": "euler_ancestral",
            "Euler": "euler",
            "DPM++ 2M": "dpmpp_2m",
            "DPM++ 2M Karras": "dpmpp_2m",
            "DPM++ SDE": "dpmpp_sde",
            "DPM++ SDE Karras": "dpmpp_sde",
            "DDIM": "ddim",
            "UniPC": "uni_pc"
        };
        const comfySampler = samplerMap[params.sampler] || "dpmpp_2m";
        const scheduler = (params.sampler || '').includes('Karras') ? 'karras' : 'normal';

        const cleanedPositive = cleanPrompt(params.prompt || "");

        workflow[ID_AI.CHECKPOINT] = {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: ckptName }
        };

        workflow[ID_AI.PROMPT_POS] = {
            class_type: "CLIPTextEncode",
            inputs: { text: cleanedPositive, clip: [ID_AI.CHECKPOINT, 1] }
        };

        workflow[ID_AI.PROMPT_NEG] = {
            class_type: "CLIPTextEncode",
            inputs: { text: enhancedNegative, clip: [ID_AI.CHECKPOINT, 1] }
        };

        workflow[ID_AI.LOAD_IMAGE] = {
            class_type: "LoadImage",
            inputs: { image: params.image_filename || "input.png", upload: "image" }
        };

        workflow[ID_AI.DINO_LOADER] = {
            class_type: "GroundingDinoModelLoader (segment anything)",
            inputs: { model_name: "GroundingDINO_SwinT_OGC (694MB)" }
        };

        workflow[ID_AI.SAM_LOADER] = {
            class_type: "SAMModelLoader (segment anything)",
            inputs: { model_name: "sam_vit_h (2.56GB)" }
        };

        workflow[ID_AI.DINO_SAM_SEGMENT] = {
            class_type: "GroundingDinoSAMSegment (segment anything)",
            inputs: {
                prompt: dinoPrompt,
                threshold: autoThreshold,
                grounding_dino_model: [ID_AI.DINO_LOADER, 0],
                sam_model: [ID_AI.SAM_LOADER, 0],
                image: [ID_AI.LOAD_IMAGE, 0]
            }
        };

        workflow[ID_AI.DILATE_MASK] = {
            class_type: "ImpactDilateMask",
            inputs: { mask: [ID_AI.DINO_SAM_SEGMENT, 1], dilation: autoMaskDilation }
        };

        workflow[ID_AI.BLUR_MASK] = {
            class_type: "ImpactGaussianBlurMask",
            inputs: { mask: [ID_AI.DILATE_MASK, 0], kernel_size: 9, sigma: 4 }
        };

        // VAEEncodeForInpaint — proper inpainting node with mask built-in
        workflow[ID_AI.VAE_ENCODE] = {
            class_type: "VAEEncodeForInpaint",
            inputs: {
                pixels: [ID_AI.LOAD_IMAGE, 0],
                vae: [ID_AI.CHECKPOINT, 2],
                mask: [ID_AI.BLUR_MASK, 0],
                grow_mask_by: 0  // Already dilated manually via ImpactDilateMask
            }
        };

        workflow[ID_AI.SAMPLER] = {
            class_type: "KSampler",
            inputs: {
                model: [ID_AI.CHECKPOINT, 0],
                positive: [ID_AI.PROMPT_POS, 0],
                negative: [ID_AI.PROMPT_NEG, 0],
                latent_image: [ID_AI.VAE_ENCODE, 0],
                seed: params.seed && params.seed !== -1 ? Number(params.seed) : Math.floor(Math.random() * 10000000),
                steps: Number(params.steps) || 30,
                cfg: Number(params.cfg_scale) || 7.0,
                sampler_name: comfySampler,
                scheduler: scheduler,
                denoise: autoDenoise
            }
        };

        workflow[ID_AI.VAE_DECODE] = {
            class_type: "VAEDecode",
            inputs: { samples: [ID_AI.SAMPLER, 0], vae: [ID_AI.CHECKPOINT, 2] }
        };

        workflow[ID_AI.SAVE_IMAGE] = {
            class_type: "SaveImage",
            inputs: { filename_prefix: "AiStudio_AutoInpaint", images: [ID_AI.VAE_DECODE, 0] }
        };
    }

    console.log("✅ Workflow generation complete. Nodes:", Object.keys(workflow));
    if (type === "img2img") {
        console.log("🖼️ Img2Img Path: Latent Node =", workflow["5"]?.inputs?.latent_image);
    }
    return workflow;
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

        // 2. Enterprise Image Preparation
        let imageFilename = job.params.image_filename;
        let maskFilename = job.params.mask_filename;

        // Strict Enterprise Validation: Ensure required files exist on disk
        if (["img2img", "inpaint", "upscale", "i2v"].includes(job.type)) {
            if (!imageFilename) {
                // Legacy Fallback (Migration Period Only): Upload if dataURL exists but filename is missing
                if (job.params.image && typeof job.params.image === 'string' && job.params.image.startsWith("data:image")) {
                    imageFilename = `${job.id}.png`;
                    console.log(`📡 Legacy Upload Detected: Processing base64 as ${imageFilename}`);
                    await uploadImageToComfy(job.params.image, imageFilename);
                } else if (job.params.image_url && typeof job.params.image_url === 'string' && job.params.image_url.startsWith("data:image")) {
                    imageFilename = `${job.id}.png`;
                    console.log(`📡 Legacy Upload Detected: Processing base64 image_url as ${imageFilename}`);
                    await uploadImageToComfy(job.params.image_url, imageFilename);
                } else {
                    throw new Error(`Enterprise Integrity Error: Job type '${job.type}' requires an image_filename but none was provided and no source data found.`);
                }
            }

            const imagePath = path.join(COMFYUI_INPUT_DIR, imageFilename);
            if (!fs.existsSync(imagePath)) {
                console.log(`☁️ File ${imageFilename} missing locally. Checking Supabase Storage...`);
                // Try to find it in the user's inputs folder
                const storagePath = `inputs/${job.user_id}/${imageFilename}`;
                const { data, error } = await supabase.storage.from('assets').download(storagePath);

                if (error || !data) {
                    console.error(`❌ Cloud Retrieval Failed for ${storagePath}:`, error?.message);
                    throw new Error(`Enterprise File System Error: Required input file '${imageFilename}' missing from local storage and cloud storage.`);
                }

                const buffer = Buffer.from(await data.arrayBuffer());
                fs.writeFileSync(imagePath, buffer);
                console.log(`✅ Successfully synced ${imageFilename} from cloud to local storage.`);
            }
            console.log(`✅ Input Verified: ${imageFilename} exists and is ready.`);
        }

        // Handle Mask for Inpainting
        if (job.type === "inpaint") {
            // Check if this is an auto-mask job (Grok AI / GroundingDINO+SAM)
            if (job.params.auto_mask) {
                console.log(`🎭 Auto-Mask Mode Detected — routing to auto_inpaint pipeline`);
                console.log(`   mask_prompt: "${job.params.mask_prompt || job.params.prompt}"`);
                // Override the job type so generateSimpleWorkflow picks the auto_inpaint branch
                job.type = "auto_inpaint";
                // Ensure mask_prompt is set (fallback to the main prompt for DINO detection)
                if (!job.params.mask_prompt) {
                    job.params.mask_prompt = job.params.prompt || "clothes";
                }
            } else {
                // Manual mask mode — require mask_filename
                if (!maskFilename) {
                    // Check both 'mask' and 'mask_url' — the API route may store base64 under either key
                    const maskBase64 = [job.params.mask, job.params.mask_url]
                        .find(v => v && typeof v === 'string' && v.startsWith("data:image"));

                    if (maskBase64) {
                        maskFilename = `mask_${job.id}.png`;
                        console.log(`📡 Mask Legacy Upload: Converting base64 mask to ${maskFilename}`);
                        await uploadImageToComfy(maskBase64, maskFilename);
                    } else {
                        throw new Error(`Enterprise Integrity Error: Inpaint job requires a mask_filename. Use Auto-Mask mode or upload a mask image.`);
                    }
                }
                const maskPath = path.join(COMFYUI_INPUT_DIR, maskFilename);
                if (!fs.existsSync(maskPath)) {
                    console.log(`☁️ Mask ${maskFilename} missing locally. Checking Supabase Storage...`);
                    const storagePath = `inputs/${job.user_id}/${maskFilename}`;
                    const { data, error } = await supabase.storage.from('assets').download(storagePath);

                    if (error || !data) {
                        throw new Error(`Enterprise File System Error: Required mask file '${maskFilename}' missing from local and cloud storage.`);
                    }

                    const buffer = Buffer.from(await data.arrayBuffer());
                    fs.writeFileSync(maskPath, buffer);
                    console.log(`✅ Successfully synced mask ${maskFilename} from cloud.`);
                }
                console.log(`✅ Mask Verified: ${maskFilename} exists.`);
            }
        }

        let workflow = job.params.workflow;
        if (!workflow) {
            console.log(`🛠️ Building Enterprise Workflow for: ${job.type}`);
            workflow = generateSimpleWorkflow({
                ...job.params,
                type: job.type,
                image_filename: imageFilename,
                mask_filename: maskFilename,
                model_id: job.params.model_id
            });
        } else if (workflow.nodes && workflow.edges) {
            // Enterprise Grade: Convert ReactFlow format back to ComfyUI API format
            console.log(`🔄 Detected ReactFlow data structure. Converting for ComfyUI...`);
            await syncWorkflowAssets(workflow.nodes);
            workflow = convertReactFlowToComfyUI(workflow.nodes, workflow.edges);
            console.log("------------------ FINAL COMFLOW JSON ------------------");
            console.log(JSON.stringify(workflow, null, 2));
            console.log("---------------------------------------------------------");
        }

        // 3. Send to ComfyUI
        const clientId = "local-worker-" + Math.random().toString(36).substring(7);

        // Setup WebSocket for progress with more debugging
        const wsUrl = `${COMFYUI_URL.replace(/^http/, 'ws')}/ws?clientId=${clientId}`;
        console.log(`🔌 Connecting to ComfyUI WS: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        let wsConnected = false;
        const wsPromise = new Promise((resolve) => {
            ws.on('open', () => {
                console.log(`✅ WS connected to ComfyUI for job ${job.id}`);
                wsConnected = true;
                resolve(true);
            });
            ws.on('error', (err) => {
                console.error(`❌ WS Error for job ${job.id}:`, err.message);
                resolve(false);
            });
            // Timeout after 5s
            setTimeout(() => {
                if (!wsConnected) {
                    console.warn(`🕒 WS connection timeout (5s) for job ${job.id}`);
                    resolve(false);
                }
            }, 5000);
        });

        ws.on('message', async (data: any) => {
            try {
                // Buffer to string handling
                const dataString = data.toString();
                const message = JSON.parse(dataString);

                if (message.type === 'progress') {
                    const progress = Math.round((message.data.value / message.data.max) * 100);
                    console.log(`⏳ Job ${job.id} progress: ${progress}%`);
                    const { error: upError } = await supabase.from('jobs').update({
                        progress,
                        status: 'processing'
                    }).eq('id', job.id);
                    if (upError) console.error("❌ Supabase Update Error (Progress):", upError.message);
                } else if (message.type === 'executing' && message.data.node) {
                    const nodeId = message.data.node;
                    console.log(`🎯 Executing node: ${nodeId}`);

                    const { error: upError } = await supabase.from('jobs').update({
                        current_node: nodeId, // Store actual ID so frontend can highlight the node
                        status: 'processing'
                    }).eq('id', job.id);

                    if (upError) console.error("❌ Supabase Update Error (Node):", upError.message);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        // Wait for WS to be ready (up to 5s)
        const ready = await wsPromise;
        if (!ready) {
            console.error("❌ WebSocket failed to connect. Falling back to polling only.");
        }

        let promptId;
        try {
            console.log(`📤 Submitting prompt to ComfyUI...`);
            console.log("------------------ PROMPT JSON ------------------");
            console.log(JSON.stringify(workflow, null, 2));
            console.log("-------------------------------------------------");
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
        let pollingAttempts = 0;
        const MAX_POLLING_ATTEMPTS = 300; // 5 minutes approx

        while (!completed) {
            try {
                // Try specific history first
                let historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
                let history = historyRes.data[promptId];

                // Fallback: Check global history if specific not found (sometimes ComfyUI quirks)
                if (!history) {
                    // Only check global every 5 seconds to omit load
                    if (pollingAttempts % 5 === 0) {
                        try {
                            const globalHistoryRes = await axios.get(`${COMFYUI_URL}/history`);
                            history = globalHistoryRes.data[promptId];
                        } catch (globalErr) {
                            // ignore
                        }
                    }
                }

                if (history && history.status && history.status.completed) {
                    completed = true;
                    outputs = history.outputs;
                    console.log("✅ ComfyUI task completed. Outputs:", JSON.stringify(Object.keys(outputs || {})));
                    ws.close();
                } else if (history && history.status && history.status.status_str === 'error') {
                    ws.close();
                    throw new Error("ComfyUI Execution Error: " + JSON.stringify(history.status.messages));
                } else {
                    pollingAttempts++;
                    if (pollingAttempts > MAX_POLLING_ATTEMPTS) {
                        ws.close();
                        throw new Error("Job timed out waiting for ComfyUI history. (Execution might have finished but history was not found)");
                    }

                    if (pollingAttempts % 10 === 0) {
                        console.log(`⏳ Waiting for history... (${pollingAttempts}/${MAX_POLLING_ATTEMPTS})`);
                    }

                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e: any) {
                console.log("⚠️ History poll error (retrying):", e.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // 5. Process and Upload Outputs
        const assetUrls: string[] = [];
        const nodeResults: Record<string, { url: string, type: string }[]> = {};

        for (const nodeId of Object.keys(outputs)) {
            const nodeOutput = outputs[nodeId];
            const outputFiles = nodeOutput.images || nodeOutput.gifs || nodeOutput.videos || [];

            if (outputFiles.length > 0) {
                nodeResults[nodeId] = [];
            }

            for (const file of outputFiles) {
                const isVideo = file.filename.endsWith('.mp4') || file.filename.endsWith('.webm') || file.filename.endsWith('.gif');
                const contentType = isVideo ?
                    (file.filename.endsWith('.mp4') ? 'video/mp4' : (file.filename.endsWith('.webm') ? 'video/webm' : 'image/gif'))
                    : 'image/png';

                console.log(`📥 Fetching output for node ${nodeId}: ${file.filename} (${contentType})`);

                const fileRes = await axios.get(`${COMFYUI_URL}/view`, {
                    params: { filename: file.filename, subfolder: file.subfolder, type: file.type },
                    responseType: 'arraybuffer'
                });

                const buffer = Buffer.from(fileRes.data);
                const storagePath = `generations/${job.user_id}/${job.id}/${file.filename}`;

                const { error: uploadError } = await supabase.storage
                    .from('assets')
                    .upload(storagePath, buffer, { contentType, upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(storagePath);
                assetUrls.push(publicUrl);
                nodeResults[nodeId].push({ url: publicUrl, type: isVideo ? 'video' : 'image' });

                const isVideoJob = job.type === 't2v' || job.type === 'i2v';
                const shouldAddToGallery = !isVideoJob || isVideo;

                if (shouldAddToGallery) {
                    await supabase
                        .from('assets')
                        .insert({
                            user_id: job.user_id,
                            job_id: job.id,
                            type: isVideo ? 'video' : 'image',
                            file_path: publicUrl,
                            prompt: job.params.prompt,
                            created_at: new Date().toISOString()
                        });
                }
            }
        }


        const { error: completeError } = await supabase.from('jobs').update({
            status: 'completed',
            progress: 100,
            outputs: { urls: assetUrls, nodeResults },
            completed_at: new Date().toISOString()
        }).eq('id', job.id);

        if (completeError) throw completeError;

        console.log(`✨ Job ${job.id} finished successfully`);

    } catch (err: any) {
        console.error(`❌ Job ${job.id} failed:`, err.message);

        // Only update if the job still exists (it might have been deleted)
        const { error } = await supabase.from('jobs').update({
            status: 'failed',
            error_message: err.message,
            completed_at: new Date().toISOString()
        }).eq('id', job.id);

        if (error) console.warn("Could not update failed status (job might be deleted):", error.message);
    }
}

// Cleanup stuck jobs (older than 10 mins)
async function cleanupStuckJobs() {
    const cutoff = new Date(Date.now() - STUCK_TIMEOUT).toISOString();

    // Find jobs sticking in processing for too long
    const { data: stuckJobs } = await supabase
        .from('jobs')
        .select('id, created_at')
        .eq('status', 'processing')
        .lt('created_at', cutoff); // Using created_at as a proxy for now, ideally use started_at or updated_at

    if (stuckJobs && stuckJobs.length > 0) {
        console.log(`🧹 Found ${stuckJobs.length} timed-out jobs. Marking as failed...`);
        for (const job of stuckJobs) {
            await supabase.from('jobs').update({
                status: 'failed',
                error_message: 'Job timed out (limit: 10 mins)'
            }).eq('id', job.id);

            // Try to interrupt ComfyUI just in case
            try {
                await axios.post(`${COMFYUI_URL}/interrupt`);
            } catch (e) { /* ignore */ }
        }
    }
}

// Reset stuck jobs on startup
async function resetStuckJobs() {
    console.log("🧹 Checking for stuck jobs...");
    const { data: stuckJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('status', 'processing');

    if (stuckJobs && stuckJobs.length > 0) {
        console.log(`⚠️ Found ${stuckJobs.length} stuck jobs (from restart). Resetting to 'pending'...`);
        for (const job of stuckJobs) {
            await supabase.from('jobs').update({ status: 'pending', current_node: null, progress: 0 }).eq('id', job.id);
        }
        console.log("✅ All stuck jobs reset.");
    } else {
        console.log("✅ No stuck jobs found.");
    }
}

// Polling interval
resetStuckJobs().then(() => {
    setInterval(pollForJobs, 1000);
    setInterval(cleanupStuckJobs, 60 * 1000); // Check for stuck jobs every minute
    pollForJobs();
});
