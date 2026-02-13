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
            num_inference_steps = 30,
            guidance_scale = 7.5,
            width = 1024,
            height = 1024,
            seed = -1,
            sampler = "euler_a",
            model_id,
            video_frames = 81,
            fps = 16,
        } = body;

        // 3. Prepare Job Data
        const jobType = body.type || "txt2img";
        const jobParams = {
            prompt,
            negative_prompt,
            width,
            height,
            steps: num_inference_steps,
            cfg_scale: guidance_scale,
            seed: seed === -1 ? Math.floor(Math.random() * 1000000000) : seed,
            sampler,
            model_id,
            video_frames,
            fps,
            image_url: body.image,
            mask_url: body.mask,
            image_filename: body.image_filename,
            mask_filename: body.mask_filename,
            denoising_strength: body.denoising_strength,
            workflow: body.workflow,
        };

        // 4. Insert Job into Supabase (acts as the queue)
        const { data: job, error: jobError } = await (supabase
            .from("jobs") as any)
            .insert({
                user_id: user.id,
                type: jobType,
                status: "pending",
                params: jobParams,
                progress: 0,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (jobError) {
            console.error("Failed to create job in Supabase:", jobError);
            return NextResponse.json(
                { error: "Failed to queue job" },
                { status: 500 }
            );
        }

        // 5. Notify the user
        return NextResponse.json({
            success: true,
            jobId: job.id,
            status: "pending",
            message: "Job queued successfully. Local worker will process it shortly."
        });

    } catch (error: any) {
        console.error("Generation error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to submit generation job" },
            { status: 500 }
        );
    }
}
