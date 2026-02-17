import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Credit cost per job type
const CREDIT_COSTS: Record<string, number> = {
    txt2img: 1,
    img2img: 1,
    inpaint: 2,
    upscale: 1,
    txt2vid: 5,
    img2vid: 5,
    workflow: 3,
};

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

        // 3. Determine job type and credit cost
        const jobType = body.type || "txt2img";
        const creditCost = CREDIT_COSTS[jobType] ?? 1;

        // 4. Check user credits
        const { data: profile, error: profileError } = await (supabase
            .from("profiles") as any)
            .select("credits, tier")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: "Could not verify your account. Please refresh and try again." },
                { status: 500 }
            );
        }

        if (profile.credits < creditCost) {
            return NextResponse.json(
                {
                    error: `Insufficient credits. This ${jobType} generation costs ${creditCost} credit${creditCost > 1 ? "s" : ""}, but you only have ${profile.credits}.`,
                    credits: profile.credits,
                    cost: creditCost,
                },
                { status: 402 }
            );
        }

        // 5. Deduct credits BEFORE creating the job (more reliable than post-completion)
        const newCredits = profile.credits - creditCost;
        const { error: updateError } = await (supabase
            .from("profiles") as any)
            .update({ credits: newCredits, updated_at: new Date().toISOString() })
            .eq("id", user.id);

        if (updateError) {
            console.error("Failed to deduct credits:", updateError);
            return NextResponse.json(
                { error: "Failed to process credits. Please try again." },
                { status: 500 }
            );
        }

        // 6. Record credit transaction
        await (supabase.from("credit_transactions") as any).insert({
            user_id: user.id,
            amount: -creditCost,
            type: "usage",
            description: `${jobType} generation`,
            balance_after: newCredits,
        });

        // 7. Prepare Job Data
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
            image: body.image,
            mask_url: body.mask,
            mask: body.mask,
            image_filename: body.image_filename,
            mask_filename: body.mask_filename,
            denoising_strength: body.denoising_strength,
            workflow: body.workflow,
        };

        // 8. Insert Job into Supabase (acts as the queue)
        const { data: job, error: jobError } = await (supabase
            .from("jobs") as any)
            .insert({
                user_id: user.id,
                type: jobType,
                status: "pending",
                params: jobParams,
                progress: 0,
                credits_estimated: creditCost,
                credits_used: creditCost,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (jobError) {
            console.error("Failed to create job in Supabase:", jobError);
            // Refund credits since job creation failed
            await (supabase.from("profiles") as any)
                .update({ credits: profile.credits, updated_at: new Date().toISOString() })
                .eq("id", user.id);
            await (supabase.from("credit_transactions") as any).insert({
                user_id: user.id,
                amount: creditCost,
                type: "refund",
                description: `Refund: ${jobType} job failed to queue`,
                balance_after: profile.credits,
            });
            return NextResponse.json(
                { error: "Failed to queue job" },
                { status: 500 }
            );
        }

        // 9. Return success with updated credits
        return NextResponse.json({
            success: true,
            jobId: job.id,
            status: "pending",
            credits: newCredits,
            creditCost,
            message: `Job queued successfully. ${creditCost} credit${creditCost > 1 ? "s" : ""} deducted.`
        });

    } catch (error: any) {
        console.error("Generation error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to submit generation job" },
            { status: 500 }
        );
    }
}
