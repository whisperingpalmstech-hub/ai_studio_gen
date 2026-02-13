"use client";

import { useState, useEffect, useRef } from "react";
import {
    Sparkles,
    Settings2,
    Shuffle,
    Download,
    Share2,
    Loader2,
    Image as ImageIcon,
    Video,
    Wand2,
    Upload,
    Zap,
    Maximize,
    Brush,
    Trash2,
    Film,
    Layers,
    Info
} from "lucide-react";

import { getSupabaseClient } from "../../../../lib/supabase/client";
import { useWebSocket } from "../../../../lib/useWebSocket";
import { useJobRealtime } from "../../../../lib/useJobRealtime";

const MODES = [
    { id: "t2v", label: "Text to Video", icon: Video },
    { id: "i2v", label: "Image to Video", icon: Film },
];

const SAMPLERS = [
    "Euler",
    "Euler a",
    "DPM++ 2M",
    "DPM++ 2M Karras",
    "DPM++ SDE",
    "DPM++ SDE Karras",
    "DDIM",
    "LMS",
];

const ASPECT_RATIOS = [
    { label: "16:9", width: 1024, height: 576 },
    { label: "9:16", width: 576, height: 1024 },
    { label: "1:1", width: 1024, height: 1024 },
    { label: "4:3", width: 1024, height: 768 },
    { label: "3:4", width: 768, height: 1024 },
];

export default function GenerateVideoPage() {
    const [mode, setMode] = useState("t2v");
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedAspect, setSelectedAspect] = useState(ASPECT_RATIOS[0]);
    const [steps, setSteps] = useState(30);
    const [cfgScale, setCfgScale] = useState(6.0);
    const [seed, setSeed] = useState(-1);
    const [sampler, setSampler] = useState(SAMPLERS[0]);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [credits, setCredits] = useState<number>(100);

    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    const [refreshKey, setRefreshKey] = useState(0);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

    // Persist prompt and settings to localStorage
    useEffect(() => {
        const savedPrompt = localStorage.getItem("last_video_prompt");
        if (savedPrompt) setPrompt(savedPrompt);

        const savedAspect = localStorage.getItem("last_video_aspect");
        if (savedAspect) {
            try {
                const aspect = JSON.parse(savedAspect);
                setSelectedAspect(aspect);
            } catch (e) { }
        }
    }, []);

    useEffect(() => {
        if (prompt) localStorage.setItem("last_video_prompt", prompt);
    }, [prompt]);

    useEffect(() => {
        if (selectedAspect) localStorage.setItem("last_video_aspect", JSON.stringify(selectedAspect));
    }, [selectedAspect]);

    // Independent Recovery Logic: Run once on mount/user change
    useEffect(() => {
        if (!userId) return;

        const recoverJob = async () => {
            const supabase = getSupabaseClient();
            console.log("🔍 Checking for recent active video jobs to recover...");

            // Only recover jobs from the last 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

            const { data: latestJob } = await (supabase
                .from('jobs') as any)
                .select('*')
                .eq('user_id', userId)
                .in('status', ['pending', 'processing', 'queued'])
                .in('type', ['t2v', 'i2v']) // Only video jobs
                .gt('created_at', fifteenMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestJob) {
                console.log("✅ Recovered active video job:", latestJob.id);
                setCurrentJobId(latestJob.id);
                setIsGenerating(true);
                // Pre-fill prompt if it's empty
                if (!prompt && latestJob.params?.prompt) {
                    setPrompt(latestJob.params.prompt);
                }
            } else {
                // Not in a generating state if no active recent job
                setIsGenerating(false);
                setCurrentJobId(null);
            }
        };

        recoverJob();
    }, [userId]);

    const handleResetUI = () => {
        setIsGenerating(false);
        setCurrentJobId(null);
        setProgress(0);
        setStatusMessage("");
        if (currentJobId) {
            localStorage.removeItem(`job_video_start_${currentJobId}`);
        }
    };

    // Polling fallback
    useEffect(() => {
        let interval: NodeJS.Timeout;

        const poll = async () => {
            if (!isGenerating || !currentJobId) return;

            const supabase = getSupabaseClient();
            const { data: job, error } = await (supabase
                .from('jobs') as any)
                .select('*')
                .eq('id', currentJobId)
                .single();

            if (job) {
                const update = job as any;

                // 1. Update Progress
                if (update.progress !== undefined && update.progress >= progress) {
                    setProgress(update.progress);
                }

                // 2. Update Status Message
                if (update.status === 'completed') {
                    setStatusMessage("Video Rendering Complete!");
                } else if (update.status === 'failed') {
                    setStatusMessage("Production Error");
                } else if (update.current_node) {
                    setStatusMessage(`Synthesis: ${update.current_node} (${update.progress || 0}%)`);
                } else if (update.status === 'processing') {
                    setStatusMessage(`Rendering Cinematic... (${update.progress || 0}%)`);
                }

                // 3. Handle Completion
                if (update.status === 'completed') {
                    const firstOutput = Array.isArray(update.outputs) ? update.outputs[0] : null;
                    if (firstOutput) {
                        setGeneratedImage(firstOutput);
                    }
                    setIsGenerating(false);
                    setProgress(100);
                    setCurrentJobId(null);
                    setRefreshKey(prev => prev + 1);
                } else if (update.status === 'failed') {
                    setIsGenerating(false);
                    setCurrentJobId(null);
                    alert(`Video Generation Failed: ${update.error_message || 'Internal error'}`);
                }
            }
        };

        if (isGenerating && currentJobId) {
            poll();
            interval = setInterval(poll, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGenerating, currentJobId]);

    // WebSocket
    const { status: wsStatus, lastMessage } = useWebSocket();
    const { lastUpdate: realtimeJobUpdate } = useJobRealtime(userId || undefined);

    useEffect(() => {
        if (realtimeJobUpdate && isGenerating && (realtimeJobUpdate.id === currentJobId || !currentJobId)) {
            console.log("⚡ Realtime Video Job Update:", realtimeJobUpdate);

            if (realtimeJobUpdate.progress !== undefined) {
                setProgress(prev => Math.max(prev, realtimeJobUpdate.progress));
            }

            if (realtimeJobUpdate.status === 'completed') {
                const fetchAsset = async () => {
                    const supabase = getSupabaseClient();
                    const { data: asset } = await (supabase
                        .from('assets') as any)
                        .select('file_path')
                        .eq('job_id', realtimeJobUpdate.id)
                        .maybeSingle();

                    if (asset?.file_path) {
                        setGeneratedImage(asset.file_path);
                    }

                    setIsGenerating(false);
                    setProgress(100);
                    setStatusMessage("Production Complete!");
                    setRefreshKey(prev => prev + 1);
                    setCurrentJobId(null);
                };
                fetchAsset();
            } else if (realtimeJobUpdate.status === 'failed') {
                setIsGenerating(false);
                setProgress(0);
                setCurrentJobId(null);
                alert(`Production Failed: ${realtimeJobUpdate.error_message || 'Unknown error'}`);
            } else if (realtimeJobUpdate.current_node) {
                setStatusMessage(`Synthesis: ${realtimeJobUpdate.current_node} (${realtimeJobUpdate.progress}%)`);
            }
        }
    }, [realtimeJobUpdate, isGenerating, currentJobId]);

    useEffect(() => {
        if (lastMessage) {
            console.log("WS Message:", lastMessage);
            // WS handle logic (optional now)
        }
    }, [lastMessage]);

    // Image Upload State
    const [inputImage, setInputImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [videoFrames, setVideoFrames] = useState(81);
    const [videoFps, setVideoFps] = useState(16);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);

    // Fetch available models
    useEffect(() => {
        const fetchModels = async () => {
            const supabase = getSupabaseClient();

            // Map frontend mode to registry type
            const typeMap: any = {
                "t2v": "text_to_video",
                "i2v": "image_to_video"
            };
            const currentWorkflow = typeMap[mode];

            const { data } = await supabase
                .from("models")
                .select("*")
                .eq("type", "checkpoint")
                .order("is_system", { ascending: false });

            if (data) {
                // Filter by metadata for Enterprise compatibility
                const filtered = (data as any[]).filter(m => {
                    const meta = m.metadata || {};
                    const compatible = meta.compatibleWorkflows || [];

                    // Fallback for older data: search for "wan" if no metadata exists
                    if (compatible.length === 0) {
                        return m.name.toLowerCase().includes('wan') || m.file_path.toLowerCase().includes('wan');
                    }

                    return compatible.includes(currentWorkflow);
                });

                setAvailableModels(filtered);

                // Set default Wan model based on mode
                const defaultModel = filtered.find(m =>
                    (mode === "t2v" && (m.name.includes("T2V") || m.metadata?.compatibleWorkflows?.includes("text_to_video"))) ||
                    (mode === "i2v" && (m.name.includes("I2V") || m.metadata?.compatibleWorkflows?.includes("image_to_video")))
                );
                setSelectedModel(defaultModel || filtered[0]);
            }
        };
        if (!isGenerating) fetchModels();
    }, [mode, isGenerating]);

    // Fetch user credits on page load
    useEffect(() => {
        const fetchCredits = async () => {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                const { data: profile } = await (supabase
                    .from("profiles") as any)
                    .select("credits")
                    .eq("id", user.id)
                    .single();

                if (profile) {
                    setCredits(profile.credits);
                }
            }
        };

        fetchCredits();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setInputImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        // 2. Enterprise Upload
        setIsUploading(true);
        setStatusMessage("Uploading cinematic base...");

        try {
            const formData = new FormData();
            formData.append("image", file);

            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const response = await fetch("http://localhost:4000/api/v1/uploads/image", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                console.log(`✅ Upload success: ${data.filename}`);
                setUploadedFilename(data.filename);
                setStatusMessage("Reference image uploaded.");
            } else {
                throw new Error(data.message || "Upload failed");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setStatusMessage(`Upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() && mode === "t2v") return;
        if (!inputImage && mode === "i2v") return;
        if (isUploading) return;

        setIsGenerating(true);
        setGeneratedImage(null);
        setProgress(0);

        const initialStatus = mode === 't2v' ? 'Starting video generation...' : 'Animating your image...';
        setStatusMessage(initialStatus);

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: mode,
                    prompt,
                    negative_prompt: negativePrompt,
                    width: selectedAspect.width,
                    height: selectedAspect.height,
                    num_inference_steps: steps,
                    guidance_scale: cfgScale,
                    seed: seed === -1 ? undefined : seed,
                    image: inputImage,
                    image_filename: uploadedFilename,
                    video_frames: videoFrames,
                    fps: videoFps,
                    model_id: selectedModel?.file_path
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate video");
            }

            if (data.status === "queued" || data.jobId) {
                setStatusMessage("Job submitted to cinematic queue...");
                if (data.jobId) setCurrentJobId(data.jobId);
            } else {
                throw new Error("No video job ID returned from API");
            }

            if (data.credits !== undefined) {
                setCredits(data.credits);
            }

        } catch (error: any) {
            console.error("Generation error:", error);
            alert("Error: " + (error.message || "Something went wrong"));
            setIsGenerating(false);
        }
    }

    const handleDownload = async () => {
        if (!generatedImage) return;
        try {
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            window.open(generatedImage, '_blank');
        }
    };

    const handleShare = async () => {
        if (!generatedImage) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({
                    title: 'AI Generated Video',
                    text: 'Check out this video I generated with AI Studio!',
                    url: generatedImage,
                });
            } else {
                await navigator.clipboard.writeText(generatedImage);
                alert("Link copied to clipboard!");
            }
        } catch (error) {
            console.error("Share error:", error);
        }
    };

    const handleRandomSeed = () => {
        setSeed(Math.floor(Math.random() * 2147483647));
    };

    // Shared Styles
    const cardStyle = {
        borderRadius: '1rem',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        backgroundColor: 'rgba(88, 28, 135, 0.1)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        backdropFilter: 'blur(12px)',
    };

    const labelStyle = {
        display: 'flex',
        fontSize: '0.875rem',
        fontWeight: 600,
        marginBottom: '0.75rem',
        color: '#e9d5ff',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const textAreaStyle = {
        width: '100%',
        padding: '1rem',
        borderRadius: '0.75rem',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        backgroundColor: 'rgba(15, 15, 35, 0.8)',
        color: 'white',
        fontSize: '0.875rem',
        outline: 'none',
        resize: 'none' as const,
        fontFamily: 'inherit',
        transition: 'border-color 0.2s',
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem 1rem',
        borderRadius: '0.625rem',
        border: '1px solid rgba(168, 85, 247, 0.2)',
        backgroundColor: 'rgba(15, 15, 35, 0.8)',
        color: 'white',
        fontSize: '0.875rem',
        height: '2.75rem',
        outline: 'none',
    };

    return (
        <div style={{ maxWidth: '80rem', margin: '0 auto', paddingBottom: '4rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h1 style={{
                            fontSize: '2.25rem',
                            fontWeight: 'bold',
                            background: 'linear-gradient(to right, #a855f7, #6366f1)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Cinematic Video
                        </h1>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            fontSize: '0.75rem'
                        }}>
                            <div style={{
                                width: '0.5rem',
                                height: '0.5rem',
                                borderRadius: '50%',
                                backgroundColor: wsStatus === 'connected' ? '#10b981' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                                boxShadow: wsStatus === 'connected' ? '0 0 8px #10b981' : 'none'
                            }} />
                            <span style={{ color: '#e9d5ff', fontWeight: 500 }}>
                                {wsStatus === 'connected' ? 'Studio Active' : wsStatus === 'connecting' ? 'Connecting...' : 'Studio Offline'}
                            </span>
                        </div>
                    </div>
                    <p style={{ color: '#a78bfa' }}>
                        Produce Hollywood-grade cinematic motion using the state-of-the-art Wan 2.1 engine.
                    </p>
                </div>
                <div style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    backdropFilter: 'blur(8px)'
                }}>
                    <Zap size={18} style={{ color: '#a855f7' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}>{credits}</span>
                        <span style={{ color: '#a78bfa', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Studio credits</span>
                    </div>
                </div>
            </div>

            {/* Mode Selection Tabs */}
            <div style={{
                display: 'flex',
                background: 'rgba(88, 28, 135, 0.2)',
                borderRadius: '1rem',
                padding: '0.375rem',
                marginBottom: '2rem',
                gap: '0.375rem',
                width: 'fit-content',
                border: '1px solid rgba(168, 85, 247, 0.1)'
            }}>
                {MODES.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.625rem',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            background: mode === m.id ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'transparent',
                            color: mode === m.id ? 'white' : '#a78bfa',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            boxShadow: mode === m.id ? '0 4px 12px rgba(168, 85, 247, 0.3)' : 'none'
                        }}
                    >
                        <m.icon size={18} />
                        {m.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem' }}>
                {/* Left Column - Input */}
                <div>
                    {/* Model Selection */}
                    <div style={cardStyle}>
                        <label style={labelStyle}>
                            <Layers size={16} color="#a855f7" />
                            Cinematic Engine
                        </label>
                        <select
                            value={selectedModel?.id || ""}
                            onChange={(e) => {
                                const model = availableModels.find(m => m.id === e.target.value);
                                setSelectedModel(model);
                            }}
                            disabled={isGenerating}
                            style={{
                                ...inputStyle,
                                opacity: isGenerating ? 0.5 : 1,
                                cursor: isGenerating ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {availableModels.map((m) => (
                                <option key={m.id} value={m.id} style={{ backgroundColor: '#1e1b4b' }}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem', color: '#a78bfa', fontSize: '0.75rem' }}>
                            <Info size={14} />
                            <span>Wan 2.1 is optimized for high-fidelity temporal consistency.</span>
                        </div>
                    </div>

                    {/* Image Upload (for I2V) */}
                    {mode === "i2v" && (
                        <div style={cardStyle}>
                            <label style={labelStyle}>
                                <Upload size={16} color="#a855f7" />
                                Base Image for Animation
                            </label>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: '2px dashed rgba(168, 85, 247, 0.3)',
                                    borderRadius: '1rem',
                                    padding: '2.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1.25rem',
                                    cursor: 'pointer',
                                    background: inputImage ? 'black' : 'rgba(168, 85, 247, 0.03)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minHeight: '260px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)'}
                            >
                                {inputImage ? (
                                    <img src={inputImage} alt="Input" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '0.5rem' }} />
                                ) : (
                                    <>
                                        <div style={{
                                            width: '4rem',
                                            height: '4rem',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#a855f7'
                                        }}>
                                            <Upload size={32} />
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{ color: 'white', fontWeight: 600, display: 'block' }}>Drop your image here</span>
                                            <span style={{ color: '#a78bfa', fontSize: '0.875rem' }}>or click to browse library</span>
                                        </div>
                                    </>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Prompt Input */}
                    <div style={cardStyle}>
                        <label style={labelStyle}>
                            <Sparkles size={16} color="#a855f7" />
                            Motion Prompt
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the action and atmosphere... e.g., 'A high-speed chase through a neon-drenched futuristic city, cinematic camera tracking, heavy rain falling, realistic motion blur...'"
                            style={{ ...textAreaStyle, height: '9rem', marginBottom: '1rem' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                                {prompt.length} tokens used
                            </span>
                            <button style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 0.875rem',
                                fontSize: '0.75rem',
                                color: 'white',
                                background: 'rgba(168, 85, 247, 0.1)',
                                border: '1px solid rgba(168, 85, 247, 0.2)',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}>
                                <Wand2 size={14} />
                                Refine with AI
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Aspect Ratio */}
                        <div style={cardStyle}>
                            <label style={labelStyle}>Aspect Ratio</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {ASPECT_RATIOS.map((ratio) => (
                                    <button
                                        key={ratio.label}
                                        onClick={() => setSelectedAspect(ratio)}
                                        style={{
                                            padding: '0.625rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: '1px solid',
                                            borderColor: selectedAspect.label === ratio.label ? '#a855f7' : 'rgba(168, 85, 247, 0.1)',
                                            cursor: 'pointer',
                                            backgroundColor: selectedAspect.label === ratio.label ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                                            color: selectedAspect.label === ratio.label ? 'white' : '#a78bfa',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {ratio.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Video Specs */}
                        <div style={cardStyle}>
                            <label style={labelStyle}>Duration & FPS</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <select
                                    value={videoFrames}
                                    onChange={(e) => setVideoFrames(Number(e.target.value))}
                                    style={inputStyle}
                                >
                                    <option value={81}>Standard (5s)</option>
                                    <option value={121}>Extended (7.5s)</option>
                                    <option value={41}>Snapshot (2.5s)</option>
                                </select>
                                <select
                                    value={videoFps}
                                    onChange={(e) => setVideoFps(Number(e.target.value))}
                                    style={inputStyle}
                                >
                                    <option value={16}>Cinematic (16 FPS)</option>
                                    <option value={24}>Smooth (24 FPS)</option>
                                    <option value={30}>Fluid (30 FPS)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.875rem',
                            color: '#a78bfa',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            marginBottom: '1.25rem',
                            fontWeight: 500
                        }}
                    >
                        <Settings2 size={16} />
                        {showAdvanced ? "Basic Settings" : "Technical Controls"}
                    </button>

                    {showAdvanced && (
                        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '-0.5rem' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <label style={labelStyle}>Guidance Scale</label>
                                    <span style={{ fontSize: '0.875rem', color: 'white', fontWeight: 700 }}>{cfgScale}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1} max={15} step={0.5}
                                    value={cfgScale}
                                    onChange={(e) => setCfgScale(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#a855f7' }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Technical Seed</label>
                                <div style={{ display: 'flex', gap: '0.625rem' }}>
                                    <input
                                        type="number"
                                        value={seed}
                                        onChange={(e) => setSeed(Number(e.target.value))}
                                        placeholder="-1 for random"
                                        style={inputStyle}
                                    />
                                    <button
                                        onClick={handleRandomSeed}
                                        style={{
                                            padding: '0 1rem',
                                            borderRadius: '0.625rem',
                                            border: '1px solid rgba(168, 85, 247, 0.2)',
                                            background: 'rgba(168, 85, 247, 0.05)',
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Shuffle size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isUploading || (mode === "t2v" && !prompt.trim()) || (mode === "i2v" && !inputImage)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            padding: '1.125rem',
                            borderRadius: '1rem',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: (isGenerating || isUploading || (mode === "t2v" && !prompt.trim()) || (mode === "i2v" && !inputImage)) ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                            color: 'white',
                            opacity: (isGenerating || isUploading || (mode === "t2v" && !prompt.trim()) || (mode === "i2v" && !inputImage)) ? 0.6 : 1,
                            boxShadow: '0 12px 30px rgba(168, 85, 247, 0.3)',
                            marginTop: '0.5rem',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                Processing Cinematic Output...
                            </>
                        ) : isUploading ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                Uploading Reference...
                            </>
                        ) : (
                            <>
                                <Film size={24} />
                                Start Production
                            </>
                        )}
                    </button>

                    {isGenerating && (
                        <button
                            onClick={handleResetUI}
                            style={{
                                width: '100%',
                                marginTop: '1rem',
                                padding: '0.625rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(168, 85, 247, 0.2)',
                                borderRadius: '0.75rem',
                                color: '#a78bfa',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        >
                            Stop & Reset Production UI
                        </button>
                    )}

                    <p style={{ fontSize: '0.8125rem', textAlign: 'center', color: '#a78bfa', marginTop: '1.25rem' }}>
                        Each Hollywood-grade render uses **5 studio credits**
                    </p>
                </div>

                {/* Right Column - Preview Area */}
                <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                    <div style={{
                        borderRadius: '1.25rem',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        backgroundColor: 'rgba(15, 15, 35, 0.5)',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        {/* Preview Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid rgba(168, 85, 247, 0.1)',
                            background: 'rgba(168, 85, 247, 0.05)'
                        }}>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Maximize size={16} color="#a855f7" />
                                Cinema Output
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    onClick={handleDownload}
                                    disabled={!generatedImage}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: generatedImage ? 'white' : 'rgba(255,255,255,0.2)',
                                        cursor: generatedImage ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    <Download size={18} />
                                </button>
                                <button
                                    onClick={handleShare}
                                    disabled={!generatedImage}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: generatedImage ? 'white' : 'rgba(255,255,255,0.2)',
                                        cursor: generatedImage ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    <Share2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Rendering Screen */}
                        <div style={{
                            position: 'relative',
                            aspectRatio: `${selectedAspect.width}/${selectedAspect.height}`,
                            backgroundColor: 'black',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {isGenerating ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    padding: '3rem',
                                    background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.08) 0%, transparent 75%)'
                                }}>
                                    {/* Specialized Video Loader */}
                                    <div style={{ position: 'relative', width: '140px', height: '140px', marginBottom: '2.5rem' }}>
                                        <div className="reel-outer" style={{
                                            position: 'absolute',
                                            inset: 0,
                                            borderRadius: '50%',
                                            border: '2px dashed #a855f7',
                                            animation: 'spin 12s linear infinite',
                                            opacity: 0.3
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            inset: '15px',
                                            borderRadius: '50%',
                                            border: '4px solid transparent',
                                            borderTopColor: '#a855f7',
                                            borderBottomColor: '#6366f1',
                                            animation: 'spin 3s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#a855f7'
                                        }}>
                                            <Film size={64} className="film-icon" />
                                        </div>
                                    </div>

                                    <h3 style={{
                                        fontSize: '1.75rem',
                                        fontWeight: 800,
                                        color: 'white',
                                        marginBottom: '0.75rem',
                                        textAlign: 'center',
                                        background: 'linear-gradient(to right, #a855f7, #6366f1)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent'
                                    }}>
                                        {statusMessage || "Calculating Motion Vectors..."}
                                    </h3>

                                    <div style={{
                                        width: '100%',
                                        maxWidth: '22rem',
                                        height: '10px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '5px',
                                        overflow: 'hidden',
                                        marginBottom: '1.25rem',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #a855f7, #6366f1, #a855f7)',
                                            backgroundSize: '200% 100%',
                                            animation: 'gradient-move 2s linear infinite',
                                            transition: 'width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)',
                                            boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)'
                                        }} />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ color: '#a855f7', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace' }}>
                                            {progress.toFixed(0).padStart(2, '0')}%
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                                        <span style={{ color: 'rgba(167, 139, 250, 0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                                            Temporal Frame Synthesis
                                        </span>
                                    </div>

                                    <style jsx>{`
                                        @keyframes spin {
                                            from { transform: rotate(0deg); }
                                            to { transform: rotate(360deg); }
                                        }
                                        @keyframes gradient-move {
                                            0% { background-position: 0% 50%; }
                                            100% { background-position: 200% 50%; }
                                        }
                                        .film-icon {
                                            animation: shim 2s ease-in-out infinite;
                                        }
                                        @keyframes shim {
                                            0%, 100% { opacity: 0.7; transform: scale(1); }
                                            50% { opacity: 1; transform: scale(1.1); }
                                        }
                                    `}</style>
                                </div>
                            ) : generatedImage ? (
                                <video
                                    src={generatedImage}
                                    controls
                                    autoPlay
                                    loop
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                                    <div style={{ scale: '2', opacity: 0.2, marginBottom: '2rem' }}>
                                        <Film size={48} />
                                    </div>
                                    <p style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '0.01em' }}>Stage is empty. Start production to see magic.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {generatedImage && (
                        <div style={{
                            marginTop: '1.5rem',
                            padding: '1.25rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(168, 85, 247, 0.05)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            backdropFilter: 'blur(8px)'
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Production Metadata</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem', color: '#a78bfa' }}>
                                <div><span style={{ opacity: 0.5 }}>Format:</span> MP4/H.264</div>
                                <div><span style={{ opacity: 0.5 }}>Engine:</span> Wan 2.1 Native</div>
                                <div><span style={{ opacity: 0.5 }}>Resolution:</span> {selectedAspect.width}×{selectedAspect.height}</div>
                                <div><span style={{ opacity: 0.5 }}>Frames:</span> {videoFrames} frames</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Video History Section */}
            <div style={{ marginTop: '5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white' }}>Studio Archives</h2>
                        <p style={{ color: '#a78bfa', fontSize: '0.875rem' }}>Your past cinematic generations</p>
                    </div>
                    <button
                        onClick={() => window.location.href = '/dashboard/gallery'}
                        style={{
                            fontSize: '0.875rem',
                            color: '#a855f7',
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Browser All
                    </button>
                </div>

                <RecentVideosGrid refreshKey={refreshKey} />
            </div>
        </div>
    );
}

function RecentVideosGrid({ refreshKey }: { refreshKey: number }) {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [localRefresh, setLocalRefresh] = useState(0);

    useEffect(() => {
        const fetchVideos = async () => {
            setLoading(true);
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('assets')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('type', 'video')
                    .order('created_at', { ascending: false })
                    .limit(8);

                if (data) setVideos(data);
            }
            setLoading(false);
        };
        fetchVideos();
    }, [refreshKey, localRefresh]);

    const handleDelete = async (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation();
        if (!confirm("Remove this production from archives?")) return;

        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const API_URL = "http://localhost:4000/api/v1";
            const response = await fetch(`${API_URL}/jobs/${jobId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (response.ok) setLocalRefresh(prev => prev + 1);
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div style={{ color: '#a78bfa', padding: '4rem', textAlign: 'center' }}>Opening archives...</div>;
    if (videos.length === 0) return (
        <div style={{ padding: '4rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px dashed rgba(168, 85, 247, 0.2)' }}>
            <p style={{ color: '#6b7280' }}>No archive footage found.</p>
        </div>
    );

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '2rem'
        }}>
            {videos.map((vid) => (
                <div
                    key={vid.id}
                    style={{
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        aspectRatio: '16/9',
                        border: '1px solid rgba(168, 85, 247, 0.1)',
                        backgroundColor: 'black',
                        position: 'relative',
                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03) translateY(-5px)';
                        e.currentTarget.style.borderColor = '#a855f7';
                        e.currentTarget.style.boxShadow = '0 15px 35px rgba(168, 85, 247, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.1)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <video
                        src={vid.file_path}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        insetInline: 0,
                        padding: '1rem',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <p style={{ color: 'white', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%', opacity: 0.8 }}>
                            {vid.prompt}
                        </p>
                        <button
                            onClick={(e) => handleDelete(e, vid.job_id)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '0.4rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
