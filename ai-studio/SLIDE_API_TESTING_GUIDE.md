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

**Cost:** 5 credits | **Time:** ~60–90 seconds

---

### ✍️ Mode 2: Custom Content (Your Own Points)
Pass your own `slides` array — skips Grok entirely, uses YOUR content.

```json
{
  "topic": "Q1 2026 Sales Report",
  "style": "corporate",
  "slides": [
    {
      "title": "Q1 Revenue Overview",
      "points": [
        "Total revenue reached $12.4M, up 23% YoY",
        "SaaS subscriptions grew to 85% of total revenue",
        "Enterprise deals closed: 14 new accounts worth $3.2M",
        "Customer retention rate maintained at 96.5%"
      ],
      "image_prompt": "Professional business chart showing upward revenue growth, blue and green corporate colors, clean infographic style"
    },
    {
      "title": "Regional Performance",
      "points": [
        "North America: $7.1M (57% of total, +18% growth)",
        "Europe: $3.2M (26% of total, +31% growth)",
        "Asia Pacific: $2.1M (17% of total, +42% growth)",
        "APAC is the fastest-growing region for the third consecutive quarter"
      ],
      "image_prompt": "World map with highlighted regions showing sales data, modern corporate presentation visual, dark blue background"
    },
    {
      "title": "Key Wins & Next Steps",
      "points": [
        "Signed 3 Fortune 500 clients in Q1",
        "Launched new AI Analytics module with 200+ early adopters",
        "Q2 target: $14M revenue with focus on APAC expansion",
        "Hiring 25 new sales reps across all regions"
      ],
      "image_prompt": "Team celebration in modern office, professional business photography, warm lighting, achievement"
    }
  ]
}
```

**Cost:** 2 credits | **Time:** ~30–60 seconds (no LLM call, only image generation)

> **Note:** `image_prompt` is optional per slide. If you skip it, a default prompt will be auto-generated from the slide title.

---

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | ✅ Yes | — | The topic / title for the presentation |
| `num_slides` | number | No | `6` | Number of slides (3–15) — *only used in Grok mode* |
| `style` | string | No | `"corporate"` | Options: `corporate`, `creative`, `minimal`, `dark` |
| `slides` | array | No | — | Your custom slide content. If provided, **skips Grok entirely** |
| `slides[].title` | string | ✅ (if slides) | — | Slide title |
| `slides[].points` | string[] | ✅ (if slides) | — | Bullet points (at least 1) |
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

```json
{
  "success": true,
  "presentation": {
    "title": "AI Revolution in Healthcare Surgery",
    "slides": [
      {
        "title": "Introduction: AI Transforming the Operating Room",
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
```

---

## 🧪 Sample Payloads

### Grok AI Mode
```json
{ "topic": "AI in Healthcare Surgery", "num_slides": 5 }
```
```json
{ "topic": "Future of Electric Vehicles", "num_slides": 6 }
```
```json
{ "topic": "Climate Change and Renewable Energy", "num_slides": 5, "style": "dark" }
```

### Custom Content Mode
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

## 💰 Credit Costs

| Mode | Cost | Description |
|------|------|-------------|
| **Grok AI mode** | 5 credits | AI generates content + images |
| **Custom content mode** | 2 credits | User provides content, only images are AI-generated |

---

## ❌ Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| `400` | `Topic must be at least 3 characters` | Topic too short |
| `400` | `Slide title is required` | Missing title in custom slides |
| `400` | `At least 1 bullet point required` | Empty points array in custom slides |
| `401` | `Invalid or missing API key` | Wrong/missing `x-api-key` header |
| `402` | `Insufficient Credits` | Not enough credits |
| `500` | `Slide Generation Failed` | Server-side error |

---

## 🔧 Tech Stack

- **LLM:** Grok (Llama 3.3 70B) via Groq API — *only in AI mode*
- **Image AI:** ComfyUI + Juggernaut XL (SDXL) model
- **PPT Engine:** pptxgenjs
- **Auth:** API Key (`x-api-key` header)
- **Credits:** 2–5 credits per presentation
