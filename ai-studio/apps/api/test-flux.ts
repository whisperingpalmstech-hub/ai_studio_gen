import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

// Initialize Supabase
const prefix = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(prefix, anonKey);

async function testFlux() {
    const jobId = uuidv4();
    console.log("Creating Job UUID:", jobId);

    const params = {
        prompt: "A slide about testing Flux Schnell, professional presentation visual, clean composition, high quality, 4k",
        negative_prompt: "text, watermark",
        width: 1024,
        height: 576,
        steps: 20,
        cfg_scale: 7,
        seed: Math.floor(Math.random() * 10000000),
        sampler: "euler_a",
        batch_size: 1,
        batch_count: 1,
        model_id: "flux1-schnell-fp8.safetensors",
    };

    const { data, error } = await supabase
        .from("jobs")
        .insert({
            id: jobId,
            user_id: "e6fbbff9-5f21-4ea7-ac29-ce4ff7c50a58", // some valid user
            type: "txt2img",
            status: "queued",
            priority: "standard",
            params: params,
            credits_estimated: 0,
            queued_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Job Insert Error:", error);
    } else {
        console.log("Successfully created job! Watch the worker terminal to see how it handles flux1-schnell-fp8.safetensors.");
    }
}

testFlux();
