/**
 * AI Slide Generator Service
 * Pipeline: Grok LLM → Slide JSON → ComfyUI (Image Gen) → PPT Assembly
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
    style?: string; // "corporate" | "creative" | "minimal" | "dark"
}

// ─── Step 1: Generate slide content via Grok LLM ─────────────────
export async function generateSlideContent(
    topic: string,
    numSlides: number = 6,
    style: string = "corporate"
): Promise<SlidePresentation> {
    console.log(`🧠 Generating slide content for: "${topic}" (${numSlides} slides, ${style} style)`);

    const systemPrompt = `You are a professional presentation designer. Generate structured slide content in JSON format.
Rules:
- Create exactly ${numSlides} slides
- Each slide must have a clear title, 3-4 bullet points, and an image_prompt
- image_prompt should describe a clean, ${style}-style illustration suitable for a presentation background
- image_prompt must be detailed and visual (colors, composition, style)
- Keep bullet points concise (max 15 words each)
- First slide should be a title/intro slide
- Last slide should be a conclusion/summary slide
- Return ONLY valid JSON, no markdown or extra text`;

    const userPrompt = `Create a professional presentation about: "${topic}"

Return this exact JSON structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "points": ["Point 1", "Point 2", "Point 3"],
      "image_prompt": "Detailed visual description for image generation"
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
                max_tokens: 4000,
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

        // Validate structure
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

// ─── Step 2: Generate images via ComfyUI ──────────────────────────
async function generateSlideImage(
    prompt: string,
    slideIndex: number,
    jobId: string
): Promise<Buffer | null> {
    console.log(`🎨 Generating image for slide ${slideIndex + 1}: "${prompt.substring(0, 60)}..."`);

    // Build a simple txt2img workflow for presentation visuals
    const workflow: Record<string, any> = {
        "4": {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: "juggernautXL_ragnarokBy.safetensors" },
        },
        "6": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: `${prompt}, professional presentation illustration, clean design, high quality, 4k, infographic style`,
                clip: ["4", 1],
            },
        },
        "7": {
            class_type: "CLIPTextEncode",
            inputs: {
                text: "text, words, letters, watermark, logo, blurry, low quality, distorted, ugly, amateur",
                clip: ["4", 1],
            },
        },
        "5": {
            class_type: "EmptyLatentImage",
            inputs: { width: 1920, height: 1080, batch_size: 1 },
        },
        "3": {
            class_type: "KSampler",
            inputs: {
                model: ["4", 0],
                positive: ["6", 0],
                negative: ["7", 0],
                latent_image: ["5", 0],
                seed: Math.floor(Math.random() * 10000000),
                steps: 25,
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
        const promptRes = await axios.post(`${COMFYUI_URL}/prompt`, {
            prompt: workflow,
            client_id: clientId,
        });

        const promptId = promptRes.data.prompt_id;
        console.log(`   🚀 Queued in ComfyUI: ${promptId}`);

        // Poll for completion (max 120 seconds)
        let completed = false;
        let outputs: any = null;
        for (let i = 0; i < 120; i++) {
            await new Promise((r) => setTimeout(r, 1000));

            try {
                const historyRes = await axios.get(`${COMFYUI_URL}/history/${promptId}`);
                const history = historyRes.data[promptId];

                if (history?.status?.completed) {
                    completed = true;
                    outputs = history.outputs;
                    break;
                }
                if (history?.status?.status_str === "error") {
                    console.error(`   ❌ ComfyUI error for slide ${slideIndex + 1}`);
                    return null;
                }
            } catch {
                // Retry
            }

            if (i % 10 === 0 && i > 0) {
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
                });
                console.log(`   ✅ Image generated for slide ${slideIndex + 1}`);
                return Buffer.from(imgRes.data);
            }
        }

        return null;
    } catch (error: any) {
        console.error(`   ❌ ComfyUI error for slide ${slideIndex + 1}:`, error.message);
        return null;
    }
}

// ─── Step 3: Assemble PPT ─────────────────────────────────────────
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

    // Color palette
    const COLORS = {
        primary: "1a1a2e",
        secondary: "16213e",
        accent: "0f3460",
        highlight: "e94560",
        text: "ffffff",
        subtext: "b8b8d0",
        darkBg: "0d0d1a",
        gradientStart: "1a1a2e",
        gradientEnd: "16213e",
    };

    for (let i = 0; i < presentation.slides.length; i++) {
        const slideData = presentation.slides[i];
        const slide = pptx.addSlide();

        // Background
        if (images[i]) {
            // Use generated image as background with dark overlay
            const base64Img = images[i]!.toString("base64");
            slide.addImage({
                data: `image/png;base64,${base64Img}`,
                x: 0,
                y: 0,
                w: "100%",
                h: "100%",
            });

            // Dark overlay for text readability
            slide.addShape(pptx.ShapeType.rect, {
                x: 0,
                y: 0,
                w: "100%",
                h: "100%",
                fill: { color: "000000", transparency: 50 },
            });
        } else {
            // Solid dark gradient background
            slide.background = { fill: COLORS.primary };
        }

        // Accent bar at top
        slide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: "100%",
            h: 0.08,
            fill: { color: COLORS.highlight },
        });

        if (i === 0) {
            // ─── Title Slide ─────────────────────
            slide.addText(slideData.title, {
                x: 0.8,
                y: 1.5,
                w: 11.5,
                h: 2,
                fontSize: 44,
                fontFace: "Arial",
                color: COLORS.text,
                bold: true,
                align: "center",
            });

            // Subtitle with points
            if (slideData.points.length > 0) {
                slide.addText(slideData.points.join(" • "), {
                    x: 1.5,
                    y: 3.8,
                    w: 10,
                    h: 1,
                    fontSize: 18,
                    fontFace: "Arial",
                    color: COLORS.subtext,
                    align: "center",
                });
            }

            // Branded footer
            slide.addText("Generated by AI Studio", {
                x: 0.8,
                y: 6.2,
                w: 11.5,
                h: 0.5,
                fontSize: 12,
                fontFace: "Arial",
                color: COLORS.subtext,
                align: "center",
                italic: true,
            });
        } else {
            // ─── Content Slide ───────────────────
            // Slide title
            slide.addText(slideData.title, {
                x: 0.8,
                y: 0.4,
                w: 11.5,
                h: 1,
                fontSize: 32,
                fontFace: "Arial",
                color: COLORS.text,
                bold: true,
            });

            // Divider line
            slide.addShape(pptx.ShapeType.rect, {
                x: 0.8,
                y: 1.4,
                w: 3,
                h: 0.04,
                fill: { color: COLORS.highlight },
            });

            // Bullet points
            const bullets = slideData.points.map((point) => ({
                text: point,
                options: {
                    fontSize: 18,
                    fontFace: "Arial" as const,
                    color: COLORS.text,
                    bullet: { type: "bullet" as const, color: COLORS.highlight },
                    breakType: "none" as const,
                    paraSpaceAfter: 14,
                },
            }));

            slide.addText(bullets, {
                x: 0.8,
                y: 1.8,
                w: 6,
                h: 4.5,
                valign: "top",
                lineSpacingMultiple: 1.5,
            });

            // Image placement (right side) if available
            if (images[i]) {
                const base64Img = images[i]!.toString("base64");
                slide.addImage({
                    data: `image/png;base64,${base64Img}`,
                    x: 7.2,
                    y: 1.6,
                    w: 5.5,
                    h: 4.8,
                    rounding: true,
                });
            }

            // Slide number
            slide.addText(`${i + 1} / ${presentation.slides.length}`, {
                x: 11.5,
                y: 6.8,
                w: 1.5,
                h: 0.4,
                fontSize: 10,
                fontFace: "Arial",
                color: COLORS.subtext,
                align: "right",
            });
        }
    }

    // Write to disk
    const filename = `slides_${jobId}.pptx`;
    const filePath = path.join(OUTPUT_DIR, filename);

    // pptxgenjs write returns base64 by default in node, use writeFile
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
    console.log(`   AI Slide Generator — Job ${jobId}`);
    console.log(`   Topic: "${options.topic}"`);
    console.log(`════════════════════════════════════════════════════\n`);

    // Step 1: Generate content
    const presentation = await generateSlideContent(
        options.topic,
        options.num_slides || 6,
        options.style || "corporate"
    );

    // Step 2: Generate images (parallel, max 3 at a time)
    console.log(`\n🎨 Generating ${presentation.slides.length} slide images...\n`);
    const images: (Buffer | null)[] = [];

    // Process in batches of 3 to avoid overloading GPU
    for (let batch = 0; batch < presentation.slides.length; batch += 3) {
        const batchSlides = presentation.slides.slice(batch, batch + 3);
        const batchPromises = batchSlides.map((slide, idx) =>
            generateSlideImage(slide.image_prompt, batch + idx, jobId)
        );
        const batchResults = await Promise.all(batchPromises);
        images.push(...batchResults);
    }

    const successCount = images.filter((img) => img !== null).length;
    console.log(`\n📊 Images generated: ${successCount}/${presentation.slides.length}`);

    // Step 3: Assemble PPT
    const filePath = await assemblePPT(presentation, images, jobId);

    console.log(`\n🎉 ════════════════════════════════════════════════`);
    console.log(`   DONE! Presentation ready: ${filePath}`);
    console.log(`════════════════════════════════════════════════════\n`);

    return { filePath, presentation, jobId };
}
