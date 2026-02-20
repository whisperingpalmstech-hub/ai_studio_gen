"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
    Code2,
    Copy,
    Check,
    BookOpen,
    Zap,
    Upload,
    ImageIcon,
    Video,
    Wand2,
    Lock,
    ArrowRight,
    Terminal,
    Globe,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Server,
} from "lucide-react";

// ── Copy Button ──
function CopyButton({ text }: { text: string }) {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            style={{
                position: "absolute",
                top: "0.75rem",
                right: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.375rem 0.625rem",
                borderRadius: "0.375rem",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: copied ? "#4ade80" : "#9ca3af",
                cursor: "pointer",
                fontSize: "0.6875rem",
                fontWeight: 500,
                transition: "all 0.2s ease",
            }}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? t("copied") : t("copy")}
        </button>
    );
}

// ── Code Block ──
function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
    return (
        <div style={{
            position: "relative",
            borderRadius: "0.75rem",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(0, 0, 0, 0.4)",
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                background: "rgba(255, 255, 255, 0.03)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}>
                <span style={{ fontSize: "0.6875rem", color: "#6b7280", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {language}
                </span>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                </div>
            </div>
            <pre style={{
                padding: "1rem 1.25rem",
                margin: 0,
                overflow: "auto",
                fontSize: "0.8125rem",
                lineHeight: 1.7,
                color: "#e2e8f0",
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            }}>
                <code>{code}</code>
            </pre>
            <CopyButton text={code} />
        </div>
    );
}

// ── Endpoint Card ──
function EndpointCard({
    method,
    path,
    description,
    params,
    response,
    example,
    isOpen,
    onToggle,
}: {
    method: string;
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
    response?: string;
    example?: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const { t } = useI18n();
    const methodColors: Record<string, { bg: string; text: string }> = {
        GET: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" },
        POST: { bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80" },
        PUT: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" },
        DELETE: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" },
    };
    const colors = methodColors[method] || methodColors.GET;

    return (
        <div style={{
            borderRadius: "0.875rem",
            border: `1px solid ${isOpen ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.06)"}`,
            background: isOpen ? "rgba(99, 102, 241, 0.02)" : "rgba(255, 255, 255, 0.02)",
            overflow: "hidden",
            transition: "all 0.3s ease",
        }}>
            <button
                onClick={onToggle}
                className="endpoint-header"
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem 1.25rem",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left" as const,
                }}
            >
                <span style={{
                    padding: "0.25rem 0.625rem",
                    borderRadius: "0.375rem",
                    background: colors.bg,
                    color: colors.text,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    letterSpacing: "0.02em",
                    border: `1px solid ${colors.text}22`,
                }}>
                    {method}
                </span>
                <code style={{ color: "#e2e8f0", fontSize: "0.875rem", fontWeight: 500, flex: 1 }}>
                    {path}
                </code>
                <span style={{ fontSize: "0.8125rem", color: "#6b7280", marginRight: "0.5rem" }}>
                    {description}
                </span>
                {isOpen ? (
                    <ChevronDown size={16} style={{ color: "#6b7280", flexShrink: 0 }} />
                ) : (
                    <ChevronRight size={16} style={{ color: "#6b7280", flexShrink: 0 }} />
                )}
            </button>

            {isOpen && (
                <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    {params && params.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                            <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", marginBottom: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                                Parameters
                            </h4>
                            <div className="responsive-table" style={{ borderRadius: "0.625rem", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                    <thead>
                                        <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                                            <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("nameLabel")}</th>
                                            <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("typeLabel")}</th>
                                            <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("requiredLabel")}</th>
                                            <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("descLabel")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {params.map((p, i) => (
                                            <tr key={i} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                                <td style={{ padding: "0.625rem 0.75rem" }}>
                                                    <code style={{ color: "#a5b4fc", fontSize: "0.8125rem", fontWeight: 500 }}>{p.name}</code>
                                                </td>
                                                <td style={{ padding: "0.625rem 0.75rem", color: "#9ca3af" }}>
                                                    <span style={{ padding: "0.125rem 0.375rem", borderRadius: "0.25rem", background: "rgba(255,255,255,0.05)", fontSize: "0.75rem" }}>
                                                        {p.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "0.625rem 0.75rem" }}>
                                                    {p.required ? (
                                                        <span style={{ color: "#f87171", fontSize: "0.75rem", fontWeight: 600 }}>{t("requiredTag")}</span>
                                                    ) : (
                                                        <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>{t("optionalTag")}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "0.625rem 0.75rem", color: "#9ca3af" }}>{p.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {example && (
                        <div style={{ marginTop: "1rem" }}>
                            <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", marginBottom: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                                Example
                            </h4>
                            <CodeBlock code={example} />
                        </div>
                    )}

                    {response && (
                        <div style={{ marginTop: "1rem" }}>
                            <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", marginBottom: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                                Response
                            </h4>
                            <CodeBlock code={response} language="json" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──
export default function ApiDocsPage() {
    const { t } = useI18n();
    const [openEndpoint, setOpenEndpoint] = useState<string | null>("upload-image");

    const toggleEndpoint = (id: string) => {
        setOpenEndpoint(openEndpoint === id ? null : id);
    };

    return (
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 1rem" }}>
            {/* Header */}
            <div style={{ marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "2.5rem",
                        height: "2.5rem",
                        borderRadius: "0.75rem",
                        background: "linear-gradient(135deg, #6366f1, #a855f7)",
                        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                    }}>
                        <Code2 size={20} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "white", letterSpacing: "-0.03em", margin: 0 }}>
                            API Documentation
                        </h1>
                        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
                            {t("apiDocsDesc")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Auth Section */}
            <div style={{
                borderRadius: "1rem",
                border: "1px solid rgba(99, 102, 241, 0.15)",
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(168, 85, 247, 0.04))",
                padding: "1.5rem",
                marginBottom: "2rem",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
                    <Lock size={18} color="#818cf8" />
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "white", margin: 0 }}>{t("authentication")}</h2>
                </div>
                <p style={{ color: "#9ca3af", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: "1rem" }}>
                    {t("authDesc")}
                </p>
                <CodeBlock
                    code={`# API Key Authentication
curl -H "x-api-key: YOUR_API_KEY" \\
  https://your-api-server.com/api/v1/jobs

# JWT Authentication  
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  https://your-api-server.com/api/v1/jobs`}
                />
            </div>

            {/* Base URL Info */}
            <div style={{
                borderRadius: "1rem",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                background: "rgba(255, 255, 255, 0.02)",
                padding: "1.25rem 1.5rem",
                marginBottom: "2rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap" as const,
            }}>
                <Server size={18} color="#6b7280" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{t("baseUrl")}</div>
                    <code style={{ color: "#e2e8f0", fontSize: "0.9375rem", fontWeight: 500 }}>
                        http://YOUR_SERVER_IP:4000/api/v1
                    </code>
                </div>
                <div style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "1rem",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.2)",
                    color: "#4ade80",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                }}>
                    v1 Stable
                </div>
            </div>

            {/* Workflow Section */}
            <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
                    Quick Start: 3-Step Workflow
                </h2>
                <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                    {t("quickStartDesc")}
                </p>
                <div className="steps-grid" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    marginBottom: "2rem",
                }}>
                    {[
                        { step: "1", title: t("step1Title"), desc: "POST /uploads/image", icon: Upload, color: "#3b82f6" },
                        { step: "2", title: t("step2Title"), desc: "POST /jobs", icon: Wand2, color: "#a855f7" },
                        { step: "3", title: t("step3Title"), desc: "GET /jobs/:id", icon: ImageIcon, color: "#10b981" },
                    ].map((s) => (
                        <div key={s.step} style={{
                            borderRadius: "0.875rem",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            background: "rgba(255, 255, 255, 0.02)",
                            padding: "1.25rem",
                            textAlign: "center" as const,
                        }}>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "2.5rem",
                                height: "2.5rem",
                                borderRadius: "0.625rem",
                                background: `${s.color}15`,
                                border: `1px solid ${s.color}25`,
                                marginBottom: "0.75rem",
                            }}>
                                <s.icon size={18} color={s.color} />
                            </div>
                            <div style={{ fontWeight: 700, color: "white", fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
                                {s.title}
                            </div>
                            <code style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.desc}</code>
                        </div>
                    ))}
                </div>
            </div>

            {/* Endpoints */}
            <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", marginBottom: "1rem", letterSpacing: "-0.02em" }}>
                    Endpoints
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <EndpointCard
                        method="POST"
                        path="/api/v1/uploads/image"
                        description="Upload an image"
                        isOpen={openEndpoint === "upload-image"}
                        onToggle={() => toggleEndpoint("upload-image")}
                        params={[
                            { name: "image", type: "File", required: true, description: "Image file (JPEG, PNG, WebP). Max 10MB." },
                        ]}
                        example={`curl -X POST http://localhost:4000/api/v1/uploads/image \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "image=@/path/to/your/photo.jpg"`}
                        response={`{
  "success": true,
  "filename": "a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png",
  "path": "/path/to/ComfyUI/input/a1b2c3d4.png"
}`}
                    />

                    <EndpointCard
                        method="POST"
                        path="/api/v1/jobs"
                        description="Create a generation job"
                        isOpen={openEndpoint === "create-job"}
                        onToggle={() => toggleEndpoint("create-job")}
                        params={[
                            { name: "type", type: "string", required: true, description: "Job type: txt2img, img2img, inpaint, auto_inpaint, t2v, i2v, workflow" },
                            { name: "prompt", type: "string", required: true, description: "Text prompt (1-2000 chars)" },
                            { name: "negative_prompt", type: "string", required: false, description: "Negative prompt" },
                            { name: "width", type: "number", required: false, description: "Output width (128-2048). Default: 512" },
                            { name: "height", type: "number", required: false, description: "Output height (128-2048). Default: 512" },
                            { name: "steps", type: "number", required: false, description: "Sampling steps (1-150). Default: 20" },
                            { name: "cfg_scale", type: "number", required: false, description: "CFG scale (1-30). Default: 7" },
                            { name: "seed", type: "number", required: false, description: "Seed (-1 for random)" },
                            { name: "image_filename", type: "string", required: false, description: "Required for img2img, inpaint, auto_inpaint" },
                            { name: "mask_prompt", type: "string", required: false, description: "Auto-mask text (for auto_inpaint): e.g. 'face', 'shirt'" },
                            { name: "denoise", type: "number", required: false, description: "Denoising strength 0-1 (for inpaint/img2img). Default: 0.75" },
                        ]}
                        example={`# Text to Image
curl -X POST http://localhost:4000/api/v1/jobs \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "txt2img",
    "prompt": "A majestic castle on a mountain, fantasy art",
    "width": 1024,
    "height": 1024,
    "steps": 25
  }'

# Auto Inpaint (AI-powered masking)
curl -X POST http://localhost:4000/api/v1/jobs \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "auto_inpaint",
    "prompt": "cyberpunk style, neon glow",
    "mask_prompt": "face",
    "image_filename": "YOUR_UPLOADED_FILENAME.png",
    "denoise": 0.85,
    "steps": 20
  }'`}
                        response={`{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "type": "auto_inpaint",
  "status": "queued",
  "credits_estimated": 3,
  "created_at": "2026-02-16T14:10:49Z"
}`}
                    />

                    <EndpointCard
                        method="GET"
                        path="/api/v1/jobs/:id"
                        description="Get job status & results"
                        isOpen={openEndpoint === "get-job"}
                        onToggle={() => toggleEndpoint("get-job")}
                        params={[
                            { name: "id", type: "UUID", required: true, description: "Job ID (from create response)" },
                        ]}
                        example={`curl http://localhost:4000/api/v1/jobs/JOB_ID_HERE \\
  -H "x-api-key: YOUR_API_KEY"`}
                        response={`{
  "id": "xxx-xxx-xxx",
  "status": "completed",
  "progress": 100,
  "outputs": {
    "urls": [
      "https://your-supabase.co/storage/.../result.png"
    ]
  },
  "assets": [
    {
      "type": "image",
      "file_path": "https://...result.png",
      "prompt": "..."
    }
  ]
}`}
                    />

                    <EndpointCard
                        method="GET"
                        path="/api/v1/jobs"
                        description="List all jobs"
                        isOpen={openEndpoint === "list-jobs"}
                        onToggle={() => toggleEndpoint("list-jobs")}
                        params={[
                            { name: "limit", type: "number", required: false, description: "Results per page (default: 20)" },
                            { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" },
                            { name: "status", type: "string", required: false, description: "Filter by status: pending, queued, processing, completed, failed" },
                        ]}
                        example={`curl "http://localhost:4000/api/v1/jobs?limit=10&status=completed" \\
  -H "x-api-key: YOUR_API_KEY"`}
                        response={`{
  "data": [...],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}`}
                    />

                    <EndpointCard
                        method="DELETE"
                        path="/api/v1/jobs/:id"
                        description="Delete a job"
                        isOpen={openEndpoint === "delete-job"}
                        onToggle={() => toggleEndpoint("delete-job")}
                        params={[
                            { name: "id", type: "UUID", required: true, description: "Job ID to delete" },
                        ]}
                        example={`curl -X DELETE http://localhost:4000/api/v1/jobs/JOB_ID_HERE \\
  -H "x-api-key: YOUR_API_KEY"`}
                        response={`{
  "message": "Job deleted successfully"
}`}
                    />

                    <EndpointCard
                        method="GET"
                        path="/api/v1/models"
                        description="List available models"
                        isOpen={openEndpoint === "list-models"}
                        onToggle={() => toggleEndpoint("list-models")}
                        example={`curl http://localhost:4000/api/v1/models \\
  -H "x-api-key: YOUR_API_KEY"`}
                        response={`{
  "data": [
    {
      "name": "dreamshaper_xl",
      "type": "checkpoint",
      "base_model": "sdxl",
      "file_path": "dreamshaperXL.safetensors"
    }
  ]
}`}
                    />
                </div>
            </div>

            {/* Job Types Reference */}
            <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", marginBottom: "1rem", letterSpacing: "-0.02em" }}>
                    Job Types & Credit Costs
                </h2>
                <div className="responsive-table" style={{
                    borderRadius: "0.875rem",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    overflow: "hidden",
                }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                            <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("typeCol")}</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("descCol")}</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t("creditsCol")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { type: "txt2img", desc: "Text to Image generation", cost: 1 },
                                { type: "img2img", desc: "Image to Image transformation", cost: 1 },
                                { type: "inpaint", desc: "Manual inpainting with mask", cost: 2 },
                                { type: "auto_inpaint", desc: "AI-powered auto-mask inpainting", cost: 3 },
                                { type: "upscale", desc: "Image upscaling", cost: 1 },
                                { type: "t2v", desc: "Text to Video generation", cost: 5 },
                                { type: "i2v", desc: "Image to Video animation", cost: 5 },
                                { type: "workflow", desc: "Custom ComfyUI workflow", cost: 1 },
                            ].map((jt, i) => (
                                <tr key={jt.type} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                    <td style={{ padding: "0.75rem 1rem" }}>
                                        <code style={{ color: "#a5b4fc", fontWeight: 600, fontSize: "0.8125rem" }}>{jt.type}</code>
                                    </td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#9ca3af" }}>{jt.desc}</td>
                                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                                        <span style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.25rem",
                                            padding: "0.25rem 0.625rem",
                                            borderRadius: "1rem",
                                            background: "rgba(245, 158, 11, 0.1)",
                                            border: "1px solid rgba(245, 158, 11, 0.2)",
                                            color: "#fbbf24",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                        }}>
                                            <Zap size={10} /> {jt.cost}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SDKs / Integration Examples */}
            <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", marginBottom: "1rem", letterSpacing: "-0.02em" }}>
                    Integration Examples
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#d1d5db", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Globe size={16} color="#60a5fa" /> JavaScript / React
                        </h3>
                        <CodeBlock
                            language="javascript"
                            code={`async function generateImage(prompt) {
  const API = "http://YOUR_SERVER:4000/api/v1";
  const KEY = "YOUR_API_KEY";

  // Create job
  const res = await fetch(\`\${API}/jobs\`, {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "txt2img", prompt, steps: 20 }),
  });
  const { id } = await res.json();

  // Poll until done
  while (true) {
    const status = await fetch(\`\${API}/jobs/\${id}\`, {
      headers: { "x-api-key": KEY },
    }).then(r => r.json());

    if (status.status === "completed") return status.outputs.urls[0];
    if (status.status === "failed") throw new Error(status.error_message);
    await new Promise(r => setTimeout(r, 2000));
  }
}`}
                        />
                    </div>

                    <div>
                        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#d1d5db", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Terminal size={16} color="#4ade80" /> Python
                        </h3>
                        <CodeBlock
                            language="python"
                            code={`import requests, time

API = "http://YOUR_SERVER:4000/api/v1"
HEADERS = {"x-api-key": "YOUR_API_KEY"}

# Upload + Auto Inpaint
with open("photo.jpg", "rb") as f:
    upload = requests.post(f"{API}/uploads/image",
        headers=HEADERS, files={"image": f}).json()

job = requests.post(f"{API}/jobs", headers={
    **HEADERS, "Content-Type": "application/json"
}, json={
    "type": "auto_inpaint",
    "prompt": "anime style",
    "mask_prompt": "face",
    "image_filename": upload["filename"],
    "denoise": 0.85
}).json()

# Poll
while True:
    r = requests.get(f"{API}/jobs/{job['id']}", 
        headers=HEADERS).json()
    if r["status"] == "completed":
        print("Result:", r["outputs"]["urls"][0])
        break
    time.sleep(2)`}
                        />
                    </div>
                </div>
            </div>

            {/* Rate Limits */}
            <div style={{
                borderRadius: "1rem",
                border: "1px solid rgba(245, 158, 11, 0.15)",
                background: "rgba(245, 158, 11, 0.03)",
                padding: "1.25rem 1.5rem",
                marginBottom: "2rem",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Zap size={18} color="#f59e0b" />
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white", margin: 0 }}>{t("rateLimitsTierInfo")}</h3>
                </div>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    fontSize: "0.875rem",
                }}>
                    {[
                        { tier: "Free", credits: "100/mo", jobs: "2 concurrent", res: "1024px" },
                        { tier: "Pro", credits: "1,000/mo", jobs: "5 concurrent", res: "2048px" },
                        { tier: "Enterprise", credits: "Unlimited", jobs: "10 concurrent", res: "4096px" },
                    ].map((t) => (
                        <div key={t.tier} style={{
                            padding: "1rem",
                            borderRadius: "0.625rem",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                        }}>
                            <div style={{ fontWeight: 700, color: "white", marginBottom: "0.5rem" }}>{t.tier}</div>
                            <div style={{ color: "#9ca3af", fontSize: "0.8125rem", lineHeight: 1.8 }}>
                                <div>Credits: <span style={{ color: "#d1d5db" }}>{t.credits}</span></div>
                                <div>Jobs: <span style={{ color: "#d1d5db" }}>{t.jobs}</span></div>
                                <div>Max Res: <span style={{ color: "#d1d5db" }}>{t.res}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
