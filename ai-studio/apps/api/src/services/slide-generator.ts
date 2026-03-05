/**
 * AI Slide Generator Service v3
 * Pipeline: Grok LLM → Rich Slide JSON → Supabase Job Queue → Local Worker → ComfyUI → PPT Assembly
 * 
 * KEY CHANGE (v3): Instead of calling ComfyUI directly (which only works locally),
 * we now create jobs in Supabase — the same pattern used by all other image generation.
 * The local worker picks them up, sends to ComfyUI, and uploads results to Supabase Storage.
 * This means Render (cloud) + local worker + ComfyUI all work together! 🚀
 */
import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import PptxGenJS from "pptxgenjs";
import { supabaseAdmin } from "./supabase.js";

// ─── Config ───────────────────────────────────────────────────────
const GROK_API_KEY = process.env.GROK_API_KEY || "";
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
    user_id?: string; // Needed for creating jobs in Supabase
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

// ─── Step 2: Generate image via Supabase Job Queue ────────────────
// This creates a txt2img job in Supabase, which the local worker picks up,
// processes through ComfyUI, and uploads the result to Supabase Storage.
// Same flow as the main /api/v1/jobs endpoint! 🔥

async function createImageJob(
    prompt: string,
    slideIndex: number,
    slideJobId: string,
    userId: string
): Promise<string> {
    const jobId = uuidv4();
    console.log(`🎨 [Slide ${slideIndex + 1}] Creating image job: ${jobId}`);
    console.log(`   Prompt: "${prompt.substring(0, 80)}..."`);

    const params = {
        prompt: `${prompt}, professional presentation visual, clean composition, high quality, 4k, sharp details, vibrant colors`,
        negative_prompt: "text, words, letters, numbers, watermark, logo, blurry, low quality, distorted, ugly, amateur, noisy, artifacts, oversaturated",
        width: 1024,
        height: 576,
        steps: 20,
        cfg_scale: 7,
        seed: Math.floor(Math.random() * 10000000),
        sampler: "euler_a",
        batch_size: 1,
        batch_count: 1,
    };

    // Insert job into Supabase — the local worker will pick it up
    const { data: job, error } = await (supabaseAdmin
        .from("jobs")
        .insert({
            id: jobId,
            user_id: userId,
            type: "txt2img" as any,
            status: "queued",
            priority: "standard" as any,
            params: params as any,
            credits_estimated: 0, // Slide images are included in the slide generation cost
            queued_at: new Date().toISOString(),
        } as any)
        .select()
        .single() as any);

    if (error) {
        console.error(`   ❌ Failed to create image job:`, error.message);
        throw new Error(`Failed to create image job: ${error.message}`);
    }

    console.log(`   ✅ Job created in Supabase: ${jobId} (status: queued)`);
    return jobId;
}

async function waitForJobCompletion(
    jobId: string,
    slideIndex: number,
    timeoutMs: number = 300000 // 5 minutes per image
): Promise<string[] | null> {
    console.log(`   ⏳ [Slide ${slideIndex + 1}] Waiting for job ${jobId}...`);
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < timeoutMs) {
        const { data: job, error } = await supabaseAdmin
            .from("jobs")
            .select("status, outputs, error_message")
            .eq("id", jobId)
            .single();

        if (error) {
            console.error(`   ❌ Error polling job ${jobId}:`, error.message);
            return null;
        }

        const jobData = job as any;

        if (jobData.status === "completed") {
            const urls = jobData.outputs?.urls || [];
            console.log(`   ✅ [Slide ${slideIndex + 1}] Job completed! ${urls.length} image(s)`);
            return urls;
        }

        if (jobData.status === "failed") {
            console.error(`   ❌ [Slide ${slideIndex + 1}] Job failed: ${jobData.error_message}`);
            return null;
        }

        // Log progress periodically
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed % 10 === 0 && elapsed > 0) {
            console.log(`   ⏳ [Slide ${slideIndex + 1}] Still waiting... (${elapsed}s, status: ${jobData.status})`);
        }

        await new Promise((r) => setTimeout(r, pollInterval));
    }

    console.error(`   ❌ [Slide ${slideIndex + 1}] Timeout after ${timeoutMs / 1000}s`);
    return null;
}

async function downloadImageFromUrl(url: string): Promise<Buffer | null> {
    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 30000,
        });
        return Buffer.from(response.data);
    } catch (error: any) {
        console.error(`   ❌ Failed to download image: ${error.message}`);
        return null;
    }
}

async function generateSlideImage(
    prompt: string,
    slideIndex: number,
    slideJobId: string,
    userId: string
): Promise<Buffer | null> {
    try {
        // Step 1: Create the job in Supabase
        const jobId = await createImageJob(prompt, slideIndex, slideJobId, userId);

        // Step 2: Wait for the local worker to process it
        const imageUrls = await waitForJobCompletion(jobId, slideIndex);

        if (!imageUrls || imageUrls.length === 0) {
            console.error(`   ❌ No image URLs returned for slide ${slideIndex + 1}`);
            return null;
        }

        // Step 3: Download the image from Supabase Storage
        const imageBuffer = await downloadImageFromUrl(imageUrls[0]);

        if (imageBuffer) {
            console.log(`   ✅ Image downloaded for slide ${slideIndex + 1} (${imageBuffer.length} bytes)`);
        }

        return imageBuffer;
    } catch (error: any) {
        console.error(`   ❌ Image generation failed for slide ${slideIndex + 1}: ${error.message}`);
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
    console.log(`   AI Slide Generator v3 — Job ${jobId}`);
    console.log(`   Topic: "${options.topic}"`);
    console.log(`   Mode: Supabase Job Queue → Local Worker → ComfyUI`);
    console.log(`════════════════════════════════════════════════════\n`);

    // Step 1: Generate content via Grok
    const presentation = await generateSlideContent(
        options.topic,
        options.num_slides || 6,
        options.style || "corporate"
    );

    // Step 2: Generate images via Supabase Job Queue
    // Each image is created as a separate job in Supabase.
    // The local worker picks them up, processes via ComfyUI, and uploads results.
    let images: (Buffer | null)[] = [];

    if (options.user_id) {
        console.log(`\n🎨 Creating ${presentation.slides.length} image jobs in Supabase...`);
        console.log(`   These will be picked up by the local worker → ComfyUI\n`);

        // Generate images ONE at a time to avoid GPU overload
        for (let idx = 0; idx < presentation.slides.length; idx++) {
            const img = await generateSlideImage(
                presentation.slides[idx].image_prompt,
                idx,
                jobId,
                options.user_id
            );
            images.push(img);
        }

        const successCount = images.filter((img) => img !== null).length;
        console.log(`\n📊 Images generated: ${successCount}/${presentation.slides.length}`);
    } else {
        console.log(`\n⚠️ No user_id provided — generating slides WITHOUT images`);
        console.log(`   (user_id is needed to create jobs in Supabase)\n`);
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
