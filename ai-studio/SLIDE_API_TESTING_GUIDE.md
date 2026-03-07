# 🎯 AI Slide Generation API — Postman Testing Guide

---

## 🔗 Base URL

```
https://ai-studio-gen-1.onrender.com
```

## 🔑 API Key

```
aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d
```

---

## 📌 Endpoint: Generate PowerPoint Presentation

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://ai-studio-gen-1.onrender.com/api/v1/slides/generate` |

### Headers (set in Postman → Headers tab)

| Key | Value |
|-----|-------|
| `x-api-key` | `aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d` |
| `Content-Type` | `application/json` |

### Body (set in Postman → Body → raw → JSON)

There are **two modes** — pick one:

---

### 🤖 Mode 1: AI-Generated Content (Grok)
Pass only a `topic` — Grok AI writes all the slide content for you.

```json
{
  "topic": "AI in Healthcare Surgery",
  "num_slides": 5,
  "style": "corporate"
}
```

**Time:** ~60–90 seconds

---

### ✍️ Mode 2: Custom Content (Your Own Points)
Pass your own `slides` array — skips Grok entirely, uses YOUR content.

```json
{
  "topic": "Q1 2026 Sales Report",
  "style": "corporate",
  "slides": [
    {
      "slideNumber": 1,
      "slideType": "title",
      "title": "Q1 Revenue Overview",
      "subtitle": "Strong momentum heading into Q2",
      "points": [
        "Total revenue reached $12.4M, up 23% YoY",
        "SaaS subscriptions grew to 85% of total revenue",
        "Enterprise deals closed: 14 new accounts worth $3.2M",
        "Customer retention rate maintained at 96.5%"
      ],
      "speakerNotes": "Welcome everyone to the Q1 wrap-up. As you can see, our SaaS revenue is leading the charge.",
      "visualDescription": "Professional business chart showing upward revenue growth",
      "colorAccent": "#06B6D4",
      "image_prompt": "Professional business chart showing upward revenue growth, blue and green corporate colors, clean infographic style"
    },
    {
      "slideNumber": 2,
      "slideType": "two-column",
      "title": "Regional Performance",
      "points": [
        "North America: $7.1M (57% of total, +18% growth)",
        "Europe: $3.2M (26% of total, +31% growth)",
        "Asia Pacific: $2.1M (17% of total, +42% growth)",
        "APAC is the fastest-growing region for the third consecutive quarter"
      ],
      "speakerNotes": "APAC growth is staggering, primarily due to our new expansions in Tokyo and Singapore.",
      "image_prompt": "World map with highlighted regions showing sales data, modern corporate presentation visual, dark blue background"
    },
    {
      "slideNumber": 3,
      "slideType": "summary",
      "title": "Key Wins & Next Steps",
      "points": [
        "Signed 3 Fortune 500 clients in Q1",
        "Launched new AI Analytics module with 200+ early adopters",
        "Q2 target: $14M revenue with focus on APAC expansion",
        "Hiring 25 new sales reps across all regions"
      ],
      "speakerNotes": "Let's carry this energy forward into Q2.",
      "image_prompt": "Team celebration in modern office, professional business photography, warm lighting, achievement"
    }
  ]
}
```

**Time:** ~30–60 seconds (no LLM call, only image generation)

> **Note:** We now support all NotebookLM schema properties optionally per slide (`slideNumber`, `slideType`, `subtitle`, `speakerNotes`, `visualDescription`, `colorAccent`, `image_prompt`). If you skip them, defaults apply.

---

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | ✅ Yes | — | The topic / title for the presentation |
| `num_slides` | number | No | `6` | Number of slides (3–15) — *only used in Grok mode* |
| `style` | string | No | `"corporate"` | Options: `corporate`, `creative`, `minimal`, `dark` |
| `model_id` | string | No | auto | Custom AI model for images (e.g., `flux1-dev-fp8.safetensors`, `sd3.5_large_fp8_scaled.safetensors`) |
| `slides` | array | No | — | Your custom slide content. If provided, **skips Grok entirely** |
| `slides[].title` | string | ✅ (if slides) | — | Slide title |
| `slides[].points` | string[] | No | `[]` | Bullet points |
| `slides[].subtitle` | string | No | — | Slide subtitle |
| `slides[].speakerNotes`| string | No | — | Detailed speaker notes for presenter mode |
| `slides[].slideType` | string | No | — | E.g. `title`, `content`, `two-column`, `infographic`, `summary` |
| `slides[].slideNumber` | number | No | — | Manual ordering control |
| `slides[].visualDescription`| string | No | — | Layout / Visual guidance description |
| `slides[].colorAccent` | string | No | — | Hex code for accent element (e.g. `#1E40AF`) |
| `slides[].image_prompt` | string | No | auto | AI image generation prompt for the slide |

### Response

- **HTTP Status:** `200 OK`
- **Content-Type:** `.pptx` (PowerPoint file — auto-downloads)
- **File Size:** ~5 MB (with AI-generated images)
- **Response Time:** ~30–90 seconds (custom is faster since no LLM call)

### 💡 How to Save the File in Postman

1. Click the **dropdown arrow (▼)** next to the Send button → select **"Send and Download"**
2. Wait ~30–90 seconds (images are AI-generated)
3. Save as `slides.pptx`
4. Open with PowerPoint / Google Slides / LibreOffice

---

## 📌 Endpoint: Generate Slide Content (JSON Preview)

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://ai-studio-gen-1.onrender.com/api/v1/slides/generate-json` |

### Headers

| Key | Value |
|-----|-------|
| `x-api-key` | `aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d` |
| `Content-Type` | `application/json` |

### Body

```json
{
  "topic": "AI in Healthcare Surgery",
  "num_slides": 5
}
```

### Response (JSON — fast, ~3 seconds)

\`\`\`json
{
  "success": true,
  "presentation": {
    "title": "AI Revolution in Healthcare Surgery",
    "summary": "This presentation explores the growing $40B impact of AI in surgery, lowering risks and accelerating recovery timelines.",
    "stats": {
      "totalSlides": 5
    },
    "slides": [
      {
        "slideNumber": 1,
        "slideType": "title",
        "title": "Introduction: AI Transforming the Operating Room",
        "subtitle": "A $40B Market Emergence",
        "speakerNotes": "Good morning. We're here to talk about how AI is reshaping surgical outcomes globally.",
        "points": [
          "AI-powered surgical systems projected to reach $40B market by 2030",
          "Machine learning predicts surgical complications with 94% accuracy",
          "Robot-assisted surgeries reduced recovery time by 30%"
        ],
        "image_prompt": "Futuristic operating room with holographic AI displays..."
      }
    ]
  }
}
\`\`\`

---

## 🧪 Sample Payloads

### Grok AI Mode (Default Model)
```json
{ "topic": "AI in Healthcare Surgery", "num_slides": 5 }
```
```json
{ "topic": "Future of Electric Vehicles", "num_slides": 6 }
```

### 🦾 High-Fidelity & Custom Model Selections
By default, the API generates imagery using the internal Juggernaut XL model. If you want to harness next-generation models like **Flux.1 Dev** or **Stable Diffusion 3.5**, pass the direct `.safetensors` filename in the `model_id` field.

**Available Models:**
* `juggernautXL_ragnarokBy.safetensors` (Default)
* `flux1-dev-fp8.safetensors` (Best Quality, High Fidelity)
* `sd3.5_large_fp8_scaled.safetensors` (Great Prompt Adherence)

#### Example: Flux.1 Dev
```json
{ 
  "topic": "Space Exploration and Colonization", 
  "num_slides": 4, 
  "model_id": "flux1-dev-fp8.safetensors"
}
```

#### Example: Stable Diffusion 3.5
```json
{ 
  "topic": "Cybersecurity Best Practices", 
  "num_slides": 3, 
  "model_id": "sd3.5_large_fp8_scaled.safetensors"
}
```

### Custom Content Mode (with Custom Model)
```json
{
  "topic": "Team Meeting Notes",
  "slides": [
    {
      "title": "Sprint 12 Summary",
      "points": [
        "Completed 34 out of 38 story points",
        "Shipped payment gateway integration",
        "Bug backlog reduced by 40%"
      ]
    },
    {
      "title": "Sprint 13 Plan",
      "points": [
        "Focus: User dashboard redesign",
        "Target: 40 story points",
        "Key dependency: Design team review by March 10"
      ],
      "image_prompt": "Modern agile sprint board with sticky notes, kanban style, professional"
    }
  ]
}
```

### 🏥 Full Example: AI in Healthcare (Custom Content — Ready to Test)

Copy-paste this into Postman Body → raw → JSON. Use **"Send and Download"** to save the `.pptx` file.

```json
{
  "topic": "AI Revolutionizing Healthcare",
  "style": "corporate",
  "slides": [
    {
      "title": "AI in Healthcare: The New Frontier",
      "points": [
        "Global AI in healthcare market projected to reach $187.95 billion by 2030",
        "AI reduces diagnostic errors by up to 85% in radiology and pathology",
        "Over 60% of healthcare organizations have adopted AI in some capacity",
        "Machine learning models can predict patient deterioration 6 hours in advance"
      ],
      "image_prompt": "Futuristic hospital lobby with holographic displays showing AI health data, blue and white theme, cinematic lighting, premium 4k render"
    },
    {
      "title": "AI-Powered Diagnostics & Imaging",
      "points": [
        "Deep learning detects breast cancer 11.5% more accurately than human radiologists",
        "AI-based retinal scans can predict cardiovascular risk with 70% accuracy",
        "Google DeepMind's AlphaFold solved protein structure prediction — a 50-year biology challenge",
        "CT scan analysis by AI reduces reading time from 20 minutes to under 30 seconds",
        "FDA has approved over 500 AI-enabled medical devices as of 2025"
      ],
      "image_prompt": "Medical MRI brain scan with AI neural network overlay highlighting anomalies, dark background, glowing blue and cyan data visualization, photorealistic"
    },
    {
      "title": "Robotic Surgery & Precision Medicine",
      "points": [
        "Da Vinci surgical system has performed over 12 million procedures worldwide",
        "AI-guided robotic surgery reduces complications by 30-40% compared to traditional methods",
        "Precision medicine uses genomic data to tailor treatments — improving outcomes by 25%",
        "AI predicts optimal drug dosages based on patient genetics, reducing adverse reactions by 50%",
        "Autonomous surgical robots expected in clinical use by 2028"
      ],
      "image_prompt": "Robotic surgical arms performing precise operation in a modern operating room, futuristic green laser guides, clean medical environment, 8k detail"
    },
    {
      "title": "Virtual Health Assistants & Patient Care",
      "points": [
        "AI chatbots handle 75% of routine patient inquiries, freeing up clinical staff",
        "Wearable AI monitors detect atrial fibrillation with 97% sensitivity",
        "Predictive AI reduces hospital readmissions by 20% through early intervention",
        "Natural language processing enables real-time medical transcription with 98% accuracy",
        "AI-powered mental health platforms serve 2 million+ users globally"
      ],
      "image_prompt": "Patient wearing smart health wearable with holographic vital signs floating above wrist, warm hospital room, soft lighting, photorealistic medical technology"
    },
    {
      "title": "The Future: What's Next for AI in Healthcare",
      "points": [
        "AI drug discovery reduces development time from 10 years to under 2 years",
        "Digital twins of patients will enable virtual treatment simulations before real procedures",
        "Federated learning allows hospitals to collaborate on AI models without sharing patient data",
        "AI-driven pandemic prediction systems could provide 6-month early warnings",
        "Estimated $150 billion in annual savings for the US healthcare system by 2030"
      ],
      "image_prompt": "Futuristic medical research lab with DNA helix hologram, scientists working with AI interfaces, blue and purple ambient lighting, cinematic wide angle shot"
    }
  ]
}
```

> **Expected Result:** 5-slide premium PPTX (~1.8 MB) with AI-generated images, completed in ~60–90 seconds. **Unlimited usage — no credit limits.**

---

## ⚡ How It Works

### Grok AI Mode
```
Client → Render API → Grok LLM (content) → Supabase Job Queue → Local Worker → ComfyUI (images) → PPT → Client
```

### Custom Content Mode
```
Client → Render API → (skip LLM) → Supabase Job Queue → Local Worker → ComfyUI (images) → PPT → Client
```

1. **Content:** Either Grok AI generates it, or you provide your own
2. **Images:** ComfyUI (Juggernaut XL model) generates AI images for each slide
3. **Assembly:** pptxgenjs assembles everything into a premium `.pptx` file
4. The file is returned as a download

---

## 📊 What Each Slide Contains

| Element | Description |
|---------|-------------|
| **Title** | AI-generated or user-provided slide title |
| **Bullet Points** | Detailed content points |
| **AI Image** | Generated via ComfyUI using Juggernaut XL (SDXL) model |
| **Design** | Premium dark theme with accent colors and branded footer |

---

## ❌ Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| `400` | `Topic must be at least 3 characters` | Topic too short |
| `400` | `Slide title is required` | Missing title in custom slides |
| `400` | `At least 1 bullet point required` | Empty points array in custom slides |
| `401` | `Invalid or missing API key` | Wrong/missing `x-api-key` header |
| `500` | `Slide Generation Failed` | Server-side error |

---

## 🔧 Tech Stack

- **LLM:** Grok (Llama 3.3 70B) via Groq API — *only in AI mode*
- **Image AI:** ComfyUI + Juggernaut XL (SDXL) model
- **PPT Engine:** pptxgenjs
- **Auth:** API Key (`x-api-key` header)
- **Usage:** Unlimited — no credit restrictions
