import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { prompt, type } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const apiKey = process.env.GROK_API_KEY || process.env.Grok_Api_Key || process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Groq API Key not configured" }, { status: 500 });
        }

        let systemPrompt = "";

        if (type === "negative") {
            systemPrompt = `You are an expert AI image generation negative prompt engineer. 
Your task is to enhance the given negative prompt keywords by adding relevant negative terms that prevent artifacts, bad anatomy, and low quality results, keeping it as a comma-separated list of keywords.
Do NOT write full sentences like "The image should not have". ONLY return the comma-separated keywords.
Example: if user gives "blurry", you return "blurry, out of focus, poor quality, noisy, jpeg artifacts, low resolution".
If user gives explicitly what they want to remove (e.g. "remove car"), keep it and add quality negative terms.`;
        } else {
            systemPrompt = `You are an expert AI image generation prompt engineer. 
Your task is to take the given short prompt and enhance it into a highly detailed, descriptive, and visually brilliant prompt optimized for Stable Diffusion / SDXL.
Focus on lighting, camera details, textures, environment, and artistic style. 
Do NOT surround the output in quotes. Do NOT add any conversational filler like "Here is the prompt:". Return ONLY the enhanced prompt.
Keep it as a cohesive paragraph or comma-separated keywords, maximum 60 words.`;
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Enhance this ${type || 'positive'} prompt:\n\n${prompt}` }
                ],
                temperature: 0.7,
                max_tokens: 150
            }),
        });

        if (!groqResponse.ok) {
            const errBody = await groqResponse.text();
            console.error("Groq API Error:", errBody);
            throw new Error(`Groq API Error: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        const enhancedPrompt = data.choices[0].message.content.trim();

        return NextResponse.json({ enhancedPrompt });

    } catch (error: any) {
        console.error("Error enhancing prompt:", error);
        return NextResponse.json(
            { error: error.message || "Failed to enhance prompt" },
            { status: 500 }
        );
    }
}
