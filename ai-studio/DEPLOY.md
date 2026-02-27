# 🚀 AI Studio API — Render Deployment Guide

## Architecture Overview

```
┌──────────────────┐       ┌─────────────────────────┐       ┌──────────────────┐
│                  │       │                         │       │                  │
│  Vercel (Web)    │──────▶│  Render (Express API)   │──────▶│  Supabase (DB)   │
│  Frontend/Next   │       │  Free Tier              │       │  Free Tier       │
│                  │       │                         │       │                  │
└──────────────────┘       └─────────────────────────┘       └──────────────────┘
                                                                    │
                                                                    ▼
                                                          ┌──────────────────────┐
                                                          │  YOUR PC (Worker)    │
                                                          │  GPU + ComfyUI       │
                                                          │  polls Supabase jobs │
                                                          └──────────────────────┘
```

**Key Insight**: Your local worker (`pnpm worker`) polls Supabase directly for pending jobs. 
The API just creates job records. No direct connection needed between API ↔ ComfyUI.

---

## Step 1: Push to GitHub

Make sure your `ai-studio` directory is pushed to GitHub (or already is):

```bash
cd ai-studio
git add -A
git commit -m "feat: add Render deployment config"
git push origin main
```

---

## Step 2: Deploy on Render

### Option A: Blueprint (One-Click) ⚡
1. Go to [render.com](https://render.com) → Sign up (free, no credit card)
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render auto-reads `render.yaml` and creates the service
5. Fill in the environment variables when prompted (see Step 3)

### Option B: Manual Setup
1. Go to [render.com](https://render.com) → Sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `ai-studio-api`
   - **Root Directory**: *(leave blank — Dockerfile is in `apps/api/`)*
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `apps/api/Dockerfile`
   - **Docker Context Directory**: `.` (repo root)
   - **Instance Type**: **Free**
5. Add environment variables (Step 3)
6. Click **Create Web Service**

---

## Step 3: Environment Variables on Render

Set these in your Render dashboard → Service → Environment:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `SUPABASE_URL` | `https://zdpkjrbkgjflnqmdsxky.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(your service role key)* |
| `JWT_SECRET` | *(your JWT secret)* |
| `REDIS_URL` | *(your Upstash Redis URL)* |
| `API_KEY` | *(your API key for team access)* |
| `GROK_API_KEY` | *(your Groq API key)* |
| `CORS_ORIGIN` | `*` |

---

## Step 4: Update Vercel Frontend

Add this environment variable in **Vercel Dashboard** → Your Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://ai-studio-api.onrender.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://ai-studio-api.onrender.com` |
| `API_URL` | `https://ai-studio-api.onrender.com/api/v1` |

> Replace `ai-studio-api` with whatever name Render gives your service.

Then **redeploy** your Vercel project so it picks up the new env vars.

---

## Step 5: Keep Local Worker Running

Your local worker stays on your PC with the GPU. It talks directly to Supabase:

```bash
cd ai-studio
pnpm worker
```

This polls Supabase for pending jobs →  processes them with ComfyUI → uploads results back.

---

## How Your Team Uses It

### Via API Key (for their tools)
Your team can call the API with an API key:

```bash
# Create a job
curl -X POST https://ai-studio-api.onrender.com/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "type": "txt2img",
    "params": {
      "prompt": "a beautiful sunset over mountains",
      "width": 1024,
      "height": 576,
      "steps": 30
    }
  }'

# Check job status
curl https://ai-studio-api.onrender.com/api/v1/jobs/JOB_ID \
  -H "x-api-key: YOUR_API_KEY"
```

### Via Dashboard (API Key generated from UI)
1. Team member signs up on the web app
2. Goes to Dashboard → API Settings → Generate Key
3. Uses the `aisk_xxxx` key in their tools

---

## Notes & Tips

### Cold Starts
Render free tier spins down after 15 minutes of inactivity. 
First request after idle takes ~30 seconds. Subsequent requests are fast.

### WebSocket Limitations
WebSockets work on Render free tier, but the connection drops when the 
instance spins down. Your frontend already has Supabase Realtime as a 
fallback (polling), so this is fine.

### Keep Worker Running 24/7
If you want your local worker always-on, use `pm2`:
```bash
npm install -g pm2
pm2 start "pnpm worker" --name ai-worker
pm2 save
pm2 startup  # Adds to system boot
```

### Custom Domain (Optional)
Render free tier supports custom domains. In Render dashboard → Settings → Custom Domains.
