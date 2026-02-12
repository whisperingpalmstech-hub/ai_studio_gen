import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        // 1. Verify User Authentication
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = session.user;

        // 2. Parse Request
        const body = await request.json();
        const {
            prompt,
            negative_prompt,
            num_inference_steps = 20,
            guidance_scale = 7.5,
            width = 512,
            height = 512,
            seed = -1,
            sampler = "euler_a",
            model_id,
            image,
            video_frames,
            fps
        } = body;

        // 3. Construct Payload for Local API
        // Map frontend params to backend execution params
        const jobPayload = {
            type: body.type || "txt2img",
            prompt,
            negative_prompt,
            width,
            height,
            steps: num_inference_steps,
            cfg_scale: guidance_scale,
            seed,
            sampler,
            model_id,
            video_frames,
            fps,
            // Add other potential params
            image_url: body.image, // For img2img/inpaint
            mask_url: body.mask,   // For inpaint
            denoising_strength: body.denoising_strength,
            workflow: body.workflow,
        };

        // 4. Submit to Local API
        const API_URL = process.env.API_URL || "http://localhost:4000/api/v1";

        console.log("Submitting job to:", `${API_URL}/jobs`);

        const response = await fetch(`${API_URL}/jobs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(jobPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Local API Error:", errorText);
            return NextResponse.json(
                { error: `Job submission failed: ${response.statusText}`, details: errorText },
                { status: response.status }
            );
        }

        const jobParam = await response.json();

        return NextResponse.json({
            success: true,
            jobId: jobParam.id,
            status: "queued"
        });

    } catch (error: any) {
        console.error("Generation proxy error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to submit generation job" },
            { status: 500 }
        );
    }
}
