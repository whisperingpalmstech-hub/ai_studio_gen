# 🎯 AI Slide Generation API — Testing Guide

> **Base URL (Deployed):** `https://ai-studio-gen-1.onrender.com`
> **Authentication:** API Key via `x-api-key` header

---

## 🔑 Authentication

All endpoints require the `x-api-key` header:

```
x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d
```

---

## 📋 Available Endpoints

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `POST` | `/api/v1/slides/generate` | Generate & download a full `.pptx` file |
| 2 | `POST` | `/api/v1/slides/generate-json` | Generate slide content as JSON (preview) |
| 3 | `GET`  | `/api/v1/slides/:jobId` | Download a previously generated presentation |

---

## 1️⃣ Generate Full PowerPoint Presentation

**Endpoint:** `POST /api/v1/slides/generate`

This endpoint generates a complete `.pptx` PowerPoint file with AI-generated content using Grok LLM and AI-generated images via ComfyUI.

### Postman Setup

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://ai-studio-gen-1.onrender.com/api/v1/slides/generate` |
| **Headers** | `x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d` |
| **Headers** | `Content-Type: application/json` |
| **Body (raw JSON)** | See below |

### Request Body

```json
{
  "topic": "AI in Healthcare Surgery",
  "num_slides": 5,
  "style": "corporate"
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | string | ✅ Yes | — | The topic for the presentation |
| `num_slides` | number | ❌ No | `6` | Number of slides to generate (2-15) |
| `style` | string | ❌ No | `"corporate"` | Style: `corporate`, `creative`, `minimal`, `dark` |

### Response

- **Content-Type:** `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- **Status:** `200 OK`
- **Body:** Binary `.pptx` file (auto-downloads in Postman)

### 💡 Postman Tip: Saving the Downloaded File

1. After sending the request, click **"Save Response"** → **"Save to a file"**
2. Name it `slides.pptx`
3. Open with Microsoft PowerPoint, Google Slides, or LibreOffice Impress

### cURL Example

```bash
curl -o slides.pptx -X POST \
  https://ai-studio-gen-1.onrender.com/api/v1/slides/generate \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "AI in Healthcare Surgery",
    "num_slides": 5,
    "style": "corporate"
  }'
```

---

## 2️⃣ Generate Slide Content as JSON (Preview)

**Endpoint:** `POST /api/v1/slides/generate-json`

Generates only the slide content (titles, bullet points, image prompts) without creating the PowerPoint file. Useful for previewing or integrating into other systems.

### Postman Setup

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://ai-studio-gen-1.onrender.com/api/v1/slides/generate-json` |
| **Headers** | `x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d` |
| **Headers** | `Content-Type: application/json` |
| **Body (raw JSON)** | See below |

### Request Body

```json
{
  "topic": "AI in Healthcare Surgery",
  "num_slides": 5,
  "style": "corporate"
}
```

### Response (JSON)

```json
{
  "success": true,
  "presentation": {
    "title": "AI Revolution in Healthcare Surgery",
    "slides": [
      {
        "title": "Introduction: AI Transforming the Operating Room",
        "points": [
          "AI-powered surgical systems are projected to reach a $40 billion market by 2030",
          "Machine learning algorithms can now predict surgical complications with 94% accuracy",
          "Robot-assisted surgeries have reduced patient recovery time by an average of 30%",
          "Over 10 million surgeries worldwide have been assisted by AI technologies since 2018"
        ],
        "image_prompt": "Futuristic operating room with holographic AI displays..."
      }
    ]
  }
}
```

### cURL Example

```bash
curl -X POST \
  https://ai-studio-gen-1.onrender.com/api/v1/slides/generate-json \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "AI in Healthcare Surgery",
    "num_slides": 5,
    "style": "corporate"
  }'
```

---

## 3️⃣ Download Previously Generated Presentation

**Endpoint:** `GET /api/v1/slides/:jobId`

Downloads a previously generated presentation by its job ID.

### Postman Setup

| Field | Value |
|-------|-------|
| **Method** | `GET` |
| **URL** | `https://ai-studio-gen-1.onrender.com/api/v1/slides/{jobId}` |
| **Headers** | `x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d` |

> Replace `{jobId}` with the actual job ID returned from the generate endpoint.

### cURL Example

```bash
curl -o slides.pptx \
  https://ai-studio-gen-1.onrender.com/api/v1/slides/abc12345 \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d"
```

---

## 🧪 Sample Topics to Test

Here are some ready-to-use topics for testing:

```json
{ "topic": "AI in Healthcare Surgery", "num_slides": 5 }
```

```json
{ "topic": "Future of Electric Vehicles", "num_slides": 6 }
```

```json
{ "topic": "Blockchain in Financial Services", "num_slides": 4 }
```

```json
{ "topic": "Climate Change and Renewable Energy", "num_slides": 5, "style": "dark" }
```

```json
{ "topic": "Machine Learning in Drug Discovery", "num_slides": 6, "style": "corporate" }
```

---

## 📊 What Each Slide Contains

| Element | Description |
|---------|-------------|
| **Title** | Professional slide title |
| **Bullet Points** | 4-6 detailed, informative points with real facts and data |
| **AI Image** | Generated via ComfyUI using Juggernaut XL model (when available) |
| **Design** | Dark premium theme with accent colors, slide numbers, and branded footer |

---

## ⚡ Response Times

| Endpoint | Render (Cloud) | Local (with ComfyUI) |
|----------|---------------|---------------------|
| `/generate` | ~5-8 seconds | ~60-120 seconds (includes image generation) |
| `/generate-json` | ~3-5 seconds | ~3-5 seconds |

> **Note:** On Render (cloud deployment), slides are generated without images since ComfyUI runs locally. On the local server with ComfyUI + GPU, full AI-generated images are included in each slide.

---

## ❌ Error Responses

### Missing Topic
```json
{
  "error": "Topic is required"
}
```

### Invalid API Key
```json
{
  "error": "Invalid or missing API key"
}
```

### Insufficient Credits
```json
{
  "error": "Insufficient credits. Required: 5, Available: 0"
}
```

---

## 🔧 Tech Stack

- **LLM:** Grok (Llama 3.3 70B) for slide content generation
- **Image Generation:** ComfyUI with Juggernaut XL (SDXL) model
- **PPT Engine:** pptxgenjs (Node.js PowerPoint generation)
- **Auth:** API Key authentication (`x-api-key` header)
- **Credits:** 5 credits deducted per presentation generation
