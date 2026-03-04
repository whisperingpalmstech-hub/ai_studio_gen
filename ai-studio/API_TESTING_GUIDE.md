# 🚀 AI Studio API - Image Generation Guide

This guide explains how to use the AI Studio API to generate images programmatically using tools like **cURL**, **Postman**, or any programming language.

## 1. API Credentials

*   **API Base URL:** `https://ai-studio-gen-1.onrender.com/api/v1`
*   **Your API Key:** `aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d`

---

## 2. Step 0: List Available Models (Optional)

You can get a full list of all available model IDs by calling this endpoint:

```bash
curl https://ai-studio-gen-1.onrender.com/api/v1/models \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d"
```

---

## 2. Step 1: Create a Generation Job

To start generating an image, send a `POST` request to the `/jobs` endpoint.

### Request Details
*   **Method:** `POST`
*   **URL:** `https://ai-studio-gen-1.onrender.com/api/v1/jobs`
*   **Headers:**
    *   `x-api-key`: `aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d`
    *   `Content-Type`: `application/json`
*   **Body (JSON):**
    ```json
    {
      "type": "txt2img",
      "prompt": "a futuristic cyberpunk city at night, masterpiece, high detail",
      "width": 1024,
      "height": 1024,
      "steps": 30,
      "model_id": "optional-uuid-here"
    }
    ```
    *   **💡 Note:** `model_id` is now **optional**. If you don't provide it, the API defaults to **Juggernaut XL** (SDXL).

### Example cURL Command (Defaulting to Juggernaut XL)
```bash
curl -X POST https://ai-studio-gen-1.onrender.com/api/v1/jobs \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "txt2img",
    "prompt": "a beautiful landscape, high detail, 8k",
    "width": 1024,
    "height": 1024
  }'
```

**Response Example:**
You will receive a Job ID. Copy this `id`.
```json
{
  "id": "3e86f9c6-fa38-4b38-8f51-66481e039a65",
  "status": "queued",
  ...
}
```

---

## 3. Step 2: Check Status and View Image

Wait about 10-30 seconds for the GPU to process the image, then check the status using the `id` from Step 1.

### Request Details
*   **Method:** `GET`
*   **URL:** `https://ai-studio-gen-1.onrender.com/api/v1/jobs/{JOB_ID}`
*   **Headers:**
    *   `x-api-key`: `aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d`

### Example cURL Command
```bash
curl https://ai-studio-gen-1.onrender.com/api/v1/jobs/REPLACE_WITH_YOUR_JOB_ID \
  -H "x-api-key: aisk_636a295b9ae0e5924a51747ffa8678f005d7a49d"
```

---

## 4. How to see the Result

When the API response shows `"status": "completed"`, you will see an **`outputs`** array containing the image URL.

### Example Response (Completed)
```json
{
  "id": "...",
  "status": "completed",
  "outputs": [
    "https://zdpkjrbkgjflnqmdsxky.supabase.co/storage/v1/object/public/outputs/3e86f9c6...png"
  ]
}
```
👉 **Click the link in the `outputs` array to view your generated image!**

---

## 5. Testing with Postman

1.  **Import cURL:** Open Postman, click **Import**, and paste the cURL command from Step 1.
2.  **Manual POST:** 
    *   Set method to `POST`.
    *   URL: `https://ai-studio-gen-1.onrender.com/api/v1/jobs`
    *   Headers: Add `x-api-key`.
    *   Body: Select `raw`, then `JSON`, and paste the prompt JSON.
3.  **Manual GET:**
    *   Set method to `GET`.
    *   URL: `https://ai-studio-gen-1.onrender.com/api/v1/jobs/{id}`
    *   Headers: Add `x-api-key`.

---

## ⚠️ Important Considerations
*   **First Request Delay:** If the API hasn't been used for 15 minutes, it may take **60 seconds** to start up (Render Free Tier).
*   **GPU Power:** Images are generated on your local PC. Ensure the **Worker** and **ComfyUI** are running.
*   **Job History:** You can see all your jobs by visiting `https://ai-studio-gen-1.onrender.com/api/v1/jobs` with your API key.
