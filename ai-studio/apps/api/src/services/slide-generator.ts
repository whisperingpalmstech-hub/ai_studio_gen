/**
 * AI Slide Generator Service v2
 * Pipeline: Grok LLM → Rich Slide JSON → ComfyUI (txt2img) → PPT Assembly
 */
import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import PptxGenJS from "pptxgenjs";

// ─── Config ───────────────────────────────────────────────────────
const GROK_API_KEY = process.env.GROK_API_KEY || "";
const COMFYUI_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188";
const OUTPUT_DIR = path.resolve("slide_outputs");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────
export interface SlideContent {
    title: string;
    points: string[];
    image_prompt: string;
}

export interface SlidePresentation {
    title: string;
    slides: SlideContent[];
}

export interface GenerateSlidesOptions {
    topic: string;
    num_slides?: number;
    style?: string;
}

// ─── Check if ComfyUI is reachable ───────────────────────────────
async function isComfyUIAvailable(): Promise<boolean> {
    try {
        await axios.get(`${COMFYUI_URL}/system_stats`, { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

// ─── Step 1: Generate RICH slide content via Grok LLM ─────────────
export async function generateSlideContent(
    topic: string,
    numSlides: number = 6,
    style: string = "corporate"
): Promise<SlidePresentation> {
    console.log(`🧠 Generating slide content for: "${topic}" (${numSlides} slides, ${style} style)`);

    const systemPrompt = `You are a world-class presentation designer and content strategist. Generate detailed, professional slide content in JSON format.

STRICT RULES:
- Create exactly ${numSlides} slides
- Each slide MUST have:
  • A clear, professional title
  • 4 to 6 detailed bullet points (each 10-25 words, informative and specific)
  • An image_prompt for AI image generation (40-80 words describing the visual)
- Bullet points must contain REAL facts, statistics, examples, or actionable insights
- Do NOT use generic/vague points like "Growth" or "Innovation" alone
- Each bullet must be a complete thought with specific information
- image_prompt must describe a photorealistic or high-quality illustration with: subject, composition, colors, style, lighting
- First slide = Title/Introduction slide
- Last slide = Conclusion/Call to Action slide
- Middle slides = Deep content slides with real substance
- Style: ${style}
- Return ONLY valid JSON, no markdown`;

    const userPrompt = `Create a comprehensive, detailed presentation about: "${topic}"

Each bullet point must be a full sentence with specific facts, data, or insights — NOT just 2-3 word labels.

Example of BAD bullet: "Healthcare Applications"
Example of GOOD bullet: "AI-powered diagnostic tools can detect cancer 30% more accurately than traditional methods"

Return this JSON structure:
{
  "title": "Professional Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "points": [
        "Detailed point with specific information and context",
        "Another informative point with real-world examples or data",
        "A third point explaining key concepts clearly",
        "Fourth point with actionable insights or implications"
      ],
      "image_prompt": "Detailed visual description: subject, composition, colors, artistic style, lighting, mood — suitable for a 1920x1080 presentation slide"
    }
  ]
}`;

    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 8000,
                response_format: { type: "json_object" },
            },
            {
                headers: {
                    Authorization: `Bearer ${GROK_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const content = response.data.choices[0].message.content;
        const parsed = JSON.parse(content);

        if (!parsed.title || !Array.isArray(parsed.slides)) {
            throw new Error("Invalid slide structure from LLM");
        }

        console.log(`✅ Generated ${parsed.slides.length} slides for: "${parsed.title}"`);
        return parsed as SlidePresentation;
    } catch (error: any) {
        console.error("❌ Grok API Error:", error.response?.data || error.message);
        throw new Error(`Failed to generate slide content: ${error.message}`);
    }
}

// ─── Step 2: Generate image via ComfyUI txt2img workflow ──────────
async function generateSlideImage(
    prompt: string,
    slideIndex: number,
    jobId: string
): Promise<Buffer | null> {
    console.log(`🎨 [Slide ${slideIndex + 1}] Generating image...`);
    console.log(`   Prompt: "${prompt.substring(0, 80)}..."`);

    // Build txt2img workflow — same as your working image generation
    const workflow: Record<string, any> = {
        "4": {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: "juggernautXL_ragnarokBy.safetensors" },
        },
        "6": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: `${prompt}, professional presentation visual, clean composition, high quality, 4k, sharp details, vibrant colors`,
                clip: ["4", 1],
            },
        },
        "7": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: "text, words, letters, numbers, watermark, logo, blurry, low quality, distorted, ugly, amateur, noisy, artifacts, oversaturated",
                clip: ["4", 1],
            },
        },
        "5": {
            class_type: "EmptyLatentImage",
            inputs: { width: 1024, height: 576, batch_size: 1 },
        },
        "3": {
            class_type: "KSampler",
            inputs: {
                model: ["4", 0],
                positive: ["6", 0],
                negative: ["7", 0],
                latent_image: ["5", 0],
                seed: Math.floor(Math.random() * 10000000),
                steps: 20,
                cfg: 7,
                sampler_name: "euler_ancestral",
                scheduler: "normal",
                denoise: 1.0,
            },
        },
        "8": {
            class_type: "VAEDecode",
            inputs: {
                samples: ["3", 0],
                vae: ["4", 2],
            },
        },
        "9": {
            class_type: "SaveImage",
            inputs: {
                images: ["8", 0],
                filename_prefix: `AiStudio_Slide_${jobId}_${slideIndex}`,
            },
        },
    };

    try {
        const clientId = `slide-gen-${jobId}-${slideIndex}`;

        // Submit prompt to ComfyUI
        const promptRes = await axios.post(
            `${COMFYUI_URL}/prompt`,
            { prompt: workflow, client_id: clientId },
            { timeout: 10000 }
        );

        const promptId = promptRes.data.prompt_id;
        console.log(`   🚀 Queued in ComfyUI: ${promptId}`);

        // Poll for completion (max 180 seconds per image)
        let completed = false;
        let outputs: any = null;
        for (let i = 0; i < 180; i++) {
            await new Promise((r) => setTimeout(r, 1000));

            try {
                const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`, { timeout: 5000 });
                const history = historyRes.data[promptId];

                if (history?.status?.completed) {
                    completed = true;
                    outputs = history.outputs;
                    break;
                }
                if (history?.status?.status_str === "error") {
                    console.error(`   ❌ ComfyUI error for slide ${slideIndex + 1}:`,
                        JSON.stringify(history.status.messages || "unknown"));
                    return null;
                }
            } catch {
                // Retry
            }

            if (i % 15 === 0 && i > 0) {
                console.log(`   ⏳ Waiting for slide ${slideIndex + 1} image... (${i}s)`);
            }
        }

        if (!completed || !outputs) {
            console.error(`   ❌ Timeout generating image for slide ${slideIndex + 1}`);
            return null;
        }

        // Fetch the generated image
        for (const nodeId of Object.keys(outputs)) {
            const files = outputs[nodeId]?.images || [];
            for (const file of files) {
                const imgRes = await axios.get(`${COMFYUI_URL}/view`, {
                    params: {
                        filename: file.filename,
                        subfolder: file.subfolder,
                        type: file.type,
                    },
                    responseType: "arraybuffer",
                    timeout: 15000,
                });
                console.log(`   ✅ Image generated for slide ${slideIndex + 1} (${Buffer.from(imgRes.data).length} bytes)`);
                return Buffer.from(imgRes.data);
            }
        }

        return null;
    } catch (error: any) {
        console.error(`   ❌ ComfyUI error for slide ${slideIndex + 1}:`, error.message);
        return null;
    }
}

// ─── Step 3: Assemble Premium PPT ─────────────────────────────────
async function assemblePPT(
    presentation: SlidePresentation,
    images: (Buffer | null)[],
    jobId: string
): Promise<string> {
    console.log(`📊 Assembling PowerPoint: "${presentation.title}"`);

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    pptx.title = presentation.title;
    pptx.author = "AI Studio";

    // Premium color palette
    const C = {
        primary: "0f172a",
        accent: "3b82f6",
        highlight: "e94560",
        text: "ffffff",
        subtext: "94a3b8",
        bulletAccent: "60a5fa",
        cardBg: "1e293b",
    };

    for (let i = 0; i < presentation.slides.length; i++) {
        const slideData = presentation.slides[i];
        const slide = pptx.addSlide();
        const hasImage = images[i] !== null;

        // ─── Background ──────────────────────────────────
        slide.background = { fill: C.primary };

        // If we have a generated image, set it as full background
        if (hasImage) {
            const base64Img = images[i]!.toString("base64");
            slide.addImage({
                data: `image/png;base64,${base64Img}`,
                x: 0, y: 0, w: "100%", h: "100%",
            });
            // Semi-transparent dark overlay for text readability
            slide.addShape(pptx.ShapeType.rect, {
                x: 0, y: 0, w: "100%", h: "100%",
                fill: { color: "000000", transparency: 45 },
            });
        }

        // Accent bar at top
        slide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: "100%", h: 0.06,
            fill: { color: C.accent },
        });

        if (i === 0) {
            // ═══════════════ TITLE SLIDE ═══════════════
            // Main title
            slide.addText(slideData.title, {
                x: 0.8, y: 1.2, w: 11.5, h: 2.5,
                fontSize: 44, fontFace: "Arial",
                color: C.text, bold: true, align: "center",
                shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.5 },
            });

            // Subtitle / Key themes
            if (slideData.points.length > 0) {
                const subtitle = slideData.points.slice(0, 3).join("  •  ");
                slide.addText(subtitle, {
                    x: 1.5, y: 3.8, w: 10, h: 1.2,
                    fontSize: 16, fontFace: "Arial",
                    color: C.subtext, align: "center",
                    lineSpacingMultiple: 1.4,
                });
            }

            // Decorative line
            slide.addShape(pptx.ShapeType.rect, {
                x: 5.4, y: 3.5, w: 2.5, h: 0.04,
                fill: { color: C.accent },
            });

            // Footer
            slide.addText("Generated by AI Studio  |  Powered by Grok + ComfyUI", {
                x: 0.8, y: 6.3, w: 11.5, h: 0.5,
                fontSize: 11, fontFace: "Arial",
                color: C.subtext, align: "center", italic: true,
            });
        } else {
            // ═══════════════ CONTENT SLIDE ═══════════════

            // Content area background card (left side)
            const contentWidth = hasImage ? 6.8 : 11.5;
            slide.addShape(pptx.ShapeType.rect, {
                x: 0.4, y: 0.35, w: contentWidth, h: 6.6,
                fill: { color: C.cardBg, transparency: hasImage ? 20 : 80 },
                rectRadius: 0.15,
            });

            // Slide title
            slide.addText(slideData.title, {
                x: 0.8, y: 0.5, w: contentWidth - 0.4, h: 1,
                fontSize: 28, fontFace: "Arial",
                color: C.text, bold: true,
            });

            // Accent divider under title
            slide.addShape(pptx.ShapeType.rect, {
                x: 0.8, y: 1.45, w: 2.5, h: 0.04,
                fill: { color: C.accent },
            });

            // Bullet points — detailed content
            const bullets = slideData.points.map((point, idx) => ({
                text: point,
                options: {
                    fontSize: 14,
                    fontFace: "Arial" as const,
                    color: C.text,
                    bullet: { type: "bullet" as const, color: C.bulletAccent },
                    breakType: "none" as const,
                    paraSpaceAfter: 10,
                    lineSpacingMultiple: 1.3,
                },
            }));

            slide.addText(bullets, {
                x: 0.8, y: 1.7,
                w: contentWidth - 0.8, h: 5,
                valign: "top",
            });

            // Image on right side (separate, not background) — if available and it's a content slide
            if (hasImage) {
                const base64Img = images[i]!.toString("base64");
                // Image card with slight rounding
                slide.addImage({
                    data: `image/png;base64,${base64Img}`,
                    x: 7.5, y: 0.6, w: 5.4, h: 6.1,
                    rounding: true,
                    shadow: { type: "outer", blur: 8, offset: 3, color: "000000", opacity: 0.4 },
                });
            }

            // Slide number
            slide.addText(`${i + 1} / ${presentation.slides.length}`, {
                x: 11.5, y: 6.9, w: 1.5, h: 0.4,
                fontSize: 9, fontFace: "Arial",
                color: C.subtext, align: "right",
            });
        }
    }

    // Write to disk
    const filename = `slides_${jobId}.pptx`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const base64Data = (await pptx.write({ outputType: "base64" })) as string;
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

    console.log(`✅ PowerPoint saved: ${filePath}`);
    return filePath;
}

// ─── Main Pipeline ────────────────────────────────────────────────
export async function generateSlides(
    options: GenerateSlidesOptions
): Promise<{ filePath: string; presentation: SlidePresentation; jobId: string }> {
    const jobId = uuidv4().substring(0, 8);
    console.log(`\n🚀 ════════════════════════════════════════════════`);
    console.log(`   AI Slide Generator v2 — Job ${jobId}`);
    console.log(`   Topic: "${options.topic}"`);
    console.log(`════════════════════════════════════════════════════\n`);

    // Step 1: Generate content via Grok
    const presentation = await generateSlideContent(
        options.topic,
        options.num_slides || 6,
        options.style || "corporate"
    );

    // Step 2: Generate images via ComfyUI (if available)
    const comfyAvailable = await isComfyUIAvailable();
    let images: (Buffer | null)[] = [];

    if (comfyAvailable) {
        console.log(`\n🎨 ComfyUI is ONLINE — Generating ${presentation.slides.length} slide images via txt2img...\n`);

        // Generate images ONE at a time to avoid GPU overload
        for (let idx = 0; idx < presentation.slides.length; idx++) {
            const img = await generateSlideImage(
                presentation.slides[idx].image_prompt,
                idx,
                jobId
            );
            images.push(img);
        }

        const successCount = images.filter((img) => img !== null).length;
        console.log(`\n📊 Images generated: ${successCount}/${presentation.slides.length}`);
    } else {
        console.log(`\n⚠️ ComfyUI not reachable at ${COMFYUI_URL} — generating slides WITHOUT images`);
        console.log(`   To enable images: start ComfyUI and run the API locally\n`);
        images = presentation.slides.map(() => null);
    }

    // Step 3: Assemble PPT
    const filePath = await assemblePPT(presentation, images, jobId);

    console.log(`\n🎉 ════════════════════════════════════════════════`);
    console.log(`   DONE! Presentation ready: ${filePath}`);
    console.log(`   Images included: ${images.filter(i => i !== null).length}/${presentation.slides.length}`);
    console.log(`════════════════════════════════════════════════════\n`);

    return { filePath, presentation, jobId };
}
