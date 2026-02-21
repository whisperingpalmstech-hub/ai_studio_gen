"use client";

import { useState, useEffect, useRef } from "react";
import { enterpriseToast } from "@/components/ui/enterprise-toast";
import { styledConfirm } from "@/components/ui/confirm-modal";
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
    Info,
    Brain
} from "lucide-react";

import { getSupabaseClient } from "../../../../lib/supabase/client";
import { useWebSocket } from "../../../../lib/useWebSocket";
import { useJobRealtime } from "../../../../lib/useJobRealtime";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { useI18n } from "@/lib/i18n";

const MODES = [
    { id: "txt2img", label: "txt2img", icon: Sparkles, cost: 1 },
    { id: "img2img", label: "img2img", icon: ImageIcon, cost: 1 },
    { id: "inpaint", label: "inpaintMode", icon: Wand2, cost: 2 },
    { id: "upscale", label: "upscaleMode", icon: Maximize, cost: 1 },
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
    { label: "1:1", width: 1024, height: 1024 },
    { label: "3:4", width: 768, height: 1024 },
    { label: "4:3", width: 1024, height: 768 },
    { label: "16:9", width: 1024, height: 576 },
    { label: "9:16", width: 576, height: 1024 },
];

export default function GeneratePage() {
    const { t } = useI18n();
    const [mode, setMode] = useState("txt2img");
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedAspect, setSelectedAspect] = useState(ASPECT_RATIOS[0]);
    const [steps, setSteps] = useState(30);
    const [cfgScale, setCfgScale] = useState(7.5);
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
    const [uploadedMaskFilename, setUploadedMaskFilename] = useState<string | null>(null);
    const [isAutoMask, setIsAutoMask] = useState(true);
    const [maskPrompt, setMaskPrompt] = useState("");
    const [isEnhancingPositive, setIsEnhancingPositive] = useState(false);
    const [isEnhancingNegative, setIsEnhancingNegative] = useState(false);

    // Persist prompt and basic settings to localStorage
    useEffect(() => {
        const savedPrompt = localStorage.getItem("last_prompt");
        if (savedPrompt) setPrompt(savedPrompt);
        const savedNegPrompt = localStorage.getItem("last_neg_prompt");
        if (savedNegPrompt) setNegativePrompt(savedNegPrompt);

        const savedAspect = localStorage.getItem("last_aspect");
        if (savedAspect) {
            try {
                const aspect = JSON.parse(savedAspect);
                setSelectedAspect(aspect);
            } catch (e) { }
        }
    }, []);

    useEffect(() => {
        if (prompt) localStorage.setItem("last_prompt", prompt);
    }, [prompt]);

    useEffect(() => {
        if (negativePrompt) localStorage.setItem("last_neg_prompt", negativePrompt);
    }, [negativePrompt]);

    useEffect(() => {
        if (selectedAspect) localStorage.setItem("last_aspect", JSON.stringify(selectedAspect));
    }, [selectedAspect]);

    // Independent Recovery Logic: Run once on mount/user change
    useEffect(() => {
        if (!userId) return;

        const recoverJob = async () => {
            const supabase = getSupabaseClient();
            console.log("🔍 Checking for recent active jobs to recover...");

            // Only recover jobs from the last 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

            const { data: latestJob } = await (supabase
                .from('jobs') as any)
                .select('*')
                .eq('user_id', userId)
                .in('status', ['pending', 'processing', 'queued'])
                .gt('created_at', fifteenMinutesAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestJob) {
                console.log("✅ Recovered active job:", latestJob.id);
                setCurrentJobId(latestJob.id);
                setIsGenerating(true);
                // Pre-fill prompt if it's empty
                if (!prompt && latestJob.params?.prompt) {
                    setPrompt(latestJob.params.prompt);
                }
            } else {
                // If no active job found, ensure we are not in generating state
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
            localStorage.removeItem(`job_start_${currentJobId}`);
        }
    };

    const handleEnhancePrompt = async (type: "positive" | "negative") => {
        const textToEnhance = type === "positive" ? prompt : negativePrompt;
        if (!textToEnhance.trim()) {
            enterpriseToast.error("Prompt Empty", `Please describe your ${type} prompt first before enhancing.`);
            return;
        }

        if (type === "positive") setIsEnhancingPositive(true);
        else setIsEnhancingNegative(true);

        try {
            const response = await fetch("/api/enhance-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: textToEnhance, type }),
            });
            const data = await response.json();
            if (response.ok && data.enhancedPrompt) {
                if (type === "positive") {
                    setPrompt(data.enhancedPrompt);
                } else {
                    setNegativePrompt(data.enhancedPrompt);
                }
                enterpriseToast.success("Prompt Enhanced", `Your ${type} prompt has been optimized by AI.`);
            } else {
                throw new Error(data.error || "Failed to enhance prompt");
            }
        } catch (error: any) {
            console.error("Enhance error:", error);
            enterpriseToast.error("Enhance Failed", error.message || "Failed to connect to AI API");
        } finally {
            if (type === "positive") setIsEnhancingPositive(false);
            else setIsEnhancingNegative(false);
        }
    };

    // Polling fallback - Simplified since recovery moved up
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

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log("⚠️ Job not found (likely deleted). Resetting UI.");
                    handleResetUI();
                } else {
                    console.error("❌ Polling Query Error:", error.message);
                }
                return;
            }

            if (job) {
                const update = job as any;
                console.log(`📥 [${update.status}] Progress: ${update.progress}% | Node: ${update.current_node}`);

                // 1. Update Progress
                if (update.progress !== undefined && update.progress >= progress) {
                    setProgress(update.progress);
                }

                // 2. Update Status Message
                if (update.status === 'completed') {
                    setStatusMessage("Generation Complete!");
                } else if (update.status === 'failed') {
                    setStatusMessage("Error: Job failed");
                } else if (update.current_node) {
                    const nodeLabel = !isNaN(Number(update.current_node)) ? `Node ${update.current_node}` : update.current_node;
                    setStatusMessage(`Status: ${nodeLabel} (${update.progress || 0}%)`);
                } else if (update.status === 'processing') {
                    setStatusMessage(`Generating... (${update.progress || 0}%)`);
                }

                // 3. Handle Completion
                if (update.status === 'completed') {
                    // Worker saves outputs as { urls: [...], nodeResults: {...} }
                    let imageUrl = null;
                    if (update.outputs) {
                        if (Array.isArray(update.outputs)) {
                            imageUrl = update.outputs[0];
                        } else if (update.outputs.urls && Array.isArray(update.outputs.urls)) {
                            imageUrl = update.outputs.urls[0];
                        }
                    }

                    if (imageUrl && typeof imageUrl === 'string') {
                        setGeneratedImage(`${imageUrl}?t=${Date.now()}`);
                    }

                    // Always stop generation state on completed
                    setIsGenerating(false);
                    setProgress(100);
                    setCurrentJobId(null);
                    setRefreshKey(prev => prev + 1);
                } else if (update.status === 'failed') {
                    setIsGenerating(false);
                    setCurrentJobId(null);
                    enterpriseToast.error("Generation Failed", update.error_message || 'Internal error');
                }
            }
        };

        const checkTimeout = () => {
            if (!isGenerating) return;
            const now = Date.now();
            // 10 minutes timeout for video, 3 mins for image
            const maxDuration = (mode === 't2v' || mode === 'i2v') ? 600000 : 180000;
            const startTime = localStorage.getItem(`job_start_${currentJobId}`);
            if (startTime && now - parseInt(startTime) > maxDuration) {
                console.warn("Job timed out - resetting UI");
                setIsGenerating(false);
                setCurrentJobId(null);
                setStatusMessage("Job timed out. Please try again.");
                localStorage.removeItem(`job_start_${currentJobId}`);
            }
        };

        if (isGenerating && currentJobId) {
            console.log("🚀 Tracking started for Job:", currentJobId);
            // Store start time for timeout check
            if (!localStorage.getItem(`job_start_${currentJobId}`)) {
                localStorage.setItem(`job_start_${currentJobId}`, Date.now().toString());
            }

            // Run once immediately
            poll();
            interval = setInterval(() => {
                poll();
                checkTimeout();
            }, 2000);
        }

        return () => {
            if (interval) {
                console.log("🛑 Polling stopped");
                clearInterval(interval);
            }
        };
    }, [isGenerating, currentJobId]);

    // WebSocket
    const { status: wsStatus, lastMessage } = useWebSocket();
    const { lastUpdate: realtimeJobUpdate } = useJobRealtime(userId || undefined);

    useEffect(() => {
        const update = realtimeJobUpdate as any;
        if (update && isGenerating && (update.id === currentJobId || !currentJobId)) {
            console.log("⚡ Realtime Update:", update.status, update.progress + "%");

            if (update.progress !== undefined) {
                setProgress(prev => Math.max(prev, update.progress));
            }

            if (update.status === 'completed') {
                // Worker saves outputs as { urls: [...], nodeResults: {...} }
                let imageUrl = null;
                if (update.outputs) {
                    if (Array.isArray(update.outputs)) {
                        imageUrl = update.outputs[0];
                    } else if (update.outputs.urls && Array.isArray(update.outputs.urls)) {
                        imageUrl = update.outputs.urls[0];
                    }
                }
                if (imageUrl) setGeneratedImage(`${imageUrl}?t=${Date.now()}`);

                setIsGenerating(false);
                setProgress(100);
                setStatusMessage("Generation Complete!");
                setRefreshKey(prev => prev + 1);
                setCurrentJobId(null);
            } else if (update.status === 'failed') {
                setIsGenerating(false);
                setProgress(0);
                setCurrentJobId(null);
                enterpriseToast.error("Job Failed", update.error_message || 'Unknown error');
            } else if (update.current_node) {
                const nodeLabel = !isNaN(Number(update.current_node)) ? `Node ${update.current_node}` : update.current_node;
                setStatusMessage(`Status: ${nodeLabel} (${update.progress}%)`);
            }
        }
    }, [realtimeJobUpdate, isGenerating, currentJobId]);

    useEffect(() => {
        if (lastMessage) {
            const { type, jobId, progress: wsProgress, message, images, asset } = lastMessage;

            // Only care about messages for current job
            if (jobId && currentJobId && jobId !== currentJobId) return;

            if (type === "job_progress") {
                setProgress(prev => Math.max(prev, wsProgress || 0));
                if (message) setStatusMessage(message);
            } else if (type === "job_complete") {
                if (images && images.length > 0) setGeneratedImage(`${images[0]}?t=${Date.now()}`);
                else if (asset && asset.file_path) setGeneratedImage(`${asset.file_path}?t=${Date.now()}`);

                setIsGenerating(false);
                setProgress(100);
                setStatusMessage("Generation Complete!");
                setRefreshKey(prev => prev + 1);
                setCurrentJobId(null);
            } else if (type === "job_failed") {
                setIsGenerating(false);
                setCurrentJobId(null);
                enterpriseToast.error("Job Failed", lastMessage.error || 'Unknown error');
            }
        }
    }, [lastMessage, currentJobId]);

    // Image Upload State
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [maskImage, setMaskImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const maskInputRef = useRef<HTMLInputElement>(null);
    const [denoisingStrength, setDenoisingStrength] = useState(0.75);
    const [upscaleFactor, setUpscaleFactor] = useState(2);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);

    // Fetch available models with Enterprise filtering
    useEffect(() => {
        const fetchModels = async () => {
            const supabase = getSupabaseClient();

            // Map frontend mode to registry type
            const typeMap: any = {
                "txt2img": "text_to_image",
                "img2img": "image_to_image",
                "inpaint": "inpaint",
                "upscale": "upscale"
            };
            const currentWorkflow = typeMap[mode];

            const { data } = await supabase
                .from("models")
                .select("*")
                .eq("type", "checkpoint")
                .order("is_system", { ascending: false });

            if (data) {
                // Enterprise Grade: Filter models by compatibility stored in metadata
                const filtered = (data as any[]).filter(m => {
                    const meta = m.metadata || {};
                    const lowerName = m.name.toLowerCase();
                    const lowerPath = m.file_path.toLowerCase();

                    // Exclude video models from image generation
                    if (lowerName.includes('wan') || lowerPath.includes('wan') || lowerName.includes('svd') || lowerPath.includes('svd')) {
                        return false;
                    }

                    const compatible = meta.compatibleWorkflows || ["text_to_image", "image_to_image"];

                    if (mode === "inpaint") {
                        // For inpaint, prioritize models that explicitly support it in metadata OR have "inpaint" in their name
                        return compatible.includes("inpaint") || lowerName.includes("inpaint") || lowerPath.includes("inpaint");
                    }

                    return compatible.includes(currentWorkflow);
                });

                setAvailableModels(filtered);

                // Select best default for the mode
                const sdxl = filtered.find(m => m.base_model === 'sdxl' || m.metadata?.architecture === 'sdxl');
                const sd15 = filtered.find(m => m.base_model === 'sd15' || m.metadata?.architecture === 'sd15');
                setSelectedModel(sdxl || sd15 || filtered[0]);
            }
        };
        if (!isGenerating) fetchModels();
    }, [mode, isGenerating]);

    // Fetch user credits and ID
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "mask") => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Preview for UI
        const reader = new FileReader();
        reader.onload = (event) => {
            if (type === "image") setInputImage(event.target?.result as string);
            else setMaskImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        // 2. Enterprise Upload to API Server
        setIsUploading(true);
        setStatusMessage(`Uploading ${type}...`);

        try {
            const formData = new FormData();
            formData.append("image", file);

            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // Upload to the internal Next.js API (Storage backed)
            const response = await fetch("/api/uploads/image", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                console.log(`✅ Upload success: ${data.filename}`);
                if (type === "image") setUploadedFilename(data.filename);
                else setUploadedMaskFilename(data.filename);
                setStatusMessage(`Upload complete.`);
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
        if (!prompt.trim() && (mode === "txt2img" || mode === "t2v")) return;
        if (!inputImage && (mode === "img2img" || mode === "inpaint" || mode === "upscale" || mode === "i2v")) return;
        if (isUploading) return;

        if (mode === "inpaint" && !isAutoMask && !maskImage) {
            enterpriseToast.error("Mask Required", "Please upload a mask image or use AI Auto-Mask.");
            return;
        }

        setIsGenerating(true);
        setGeneratedImage(null);
        setProgress(0);

        const initialStatus = mode === 'txt2img' ? 'Initiating creation...' :
            mode === 'img2img' ? 'Analyzing input image...' :
                mode === 't2v' ? 'Starting video generation...' :
                    mode === 'i2v' ? 'Animating your image...' :
                        mode === 'inpaint' ? (isAutoMask ? 'AI is analyzing prompt...' : 'Preparing mask region...') : 'Starting engine...';

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
                    scheduler: "K_EULER",
                    seed: seed === -1 ? undefined : seed,
                    image: inputImage,
                    mask: isAutoMask ? undefined : maskImage,
                    image_filename: uploadedFilename,
                    mask_filename: isAutoMask ? undefined : uploadedMaskFilename,
                    auto_mask: mode === "inpaint" ? isAutoMask : false,
                    mask_prompt: (mode === "inpaint" && isAutoMask) ? maskPrompt : undefined,
                    denoising_strength: denoisingStrength,
                    upscale_factor: upscaleFactor,
                    model_id: selectedModel?.file_path
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate image");
            }

            if (data.images && data.images.length > 0) {
                setGeneratedImage(data.images[0]);
                setIsGenerating(false);
            } else if (data.status === "queued" || data.jobId) {
                setStatusMessage("Job submitted to queue...");
                if (data.jobId) setCurrentJobId(data.jobId);
                setGeneratedImage(null);
                setProgress(0);
            } else {
                throw new Error("No image returned from API");
            }

            if (data.credits !== undefined) {
                setCredits(data.credits);
            }
            if (data.creditCost) {
                enterpriseToast.success("Job Queued", `Generation started • ${data.creditCost} credit${data.creditCost > 1 ? 's' : ''} deducted`);
            }

        } catch (error: any) {
            console.error("Generation error:", error);
            enterpriseToast.error("Generation Error", error.message || "Something went wrong");
            setIsGenerating(false);
        }
    };
    const handleDownload = async () => {
        if (!generatedImage) return;
        try {
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `generation-${Date.now()}.${generatedImage.includes('.mp4') ? 'mp4' : 'png'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download error:", error);
            const a = document.createElement('a');
            a.href = generatedImage;
            a.download = `generation-${Date.now()}.${generatedImage.includes('.mp4') ? 'mp4' : 'png'}`;
            a.target = "_blank";
            a.click();
        }
    };

    const handleShare = async () => {
        if (!generatedImage) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({
                    title: 'AI Generated Image',
                    text: 'Check out this image I generated with AI Studio!',
                    url: generatedImage,
                });
            } else {
                await navigator.clipboard.writeText(generatedImage);
                enterpriseToast.success("Copied!", "Image link copied to clipboard");
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
        borderRadius: '0.75rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
    };

    const labelStyle = {
        display: 'flex',
        fontSize: '0.875rem',
        fontWeight: 500,
        marginBottom: '0.75rem',
        color: 'white',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const textAreaStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 15, 35, 0.6)',
        color: 'white',
        fontSize: '0.875rem',
        outline: 'none',
        resize: 'none' as const,
        fontFamily: 'inherit',
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 15, 35, 0.6)',
        color: 'white',
        fontSize: '0.875rem',
        height: '2.5rem',
        outline: 'none',
    };

    return (
        <div style={{ maxWidth: '80rem', margin: '0 auto', paddingBottom: '4rem', padding: '0 1rem 4rem' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white' }}>
                            Generate Image
                        </h1>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '1rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '0.75rem'
                        }}>
                            <div style={{
                                width: '0.5rem',
                                height: '0.5rem',
                                borderRadius: '50%',
                                backgroundColor: wsStatus === 'connected' ? '#10b981' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                                boxShadow: wsStatus === 'connected' ? '0 0 8px #10b981' : 'none'
                            }} />
                            <span style={{ color: '#d1d5db', fontWeight: 500 }}>
                                {wsStatus === 'connected' ? 'Server Connected' : wsStatus === 'connecting' ? 'Connecting...' : 'Server Offline'}
                            </span>
                        </div>
                    </div>
                    <p style={{ color: '#9ca3af' }}>
                        Transform your ideas into stunning visual art with our advanced AI engine.
                    </p>
                </div>
                <div className="credit-badge" style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    backdropFilter: 'blur(8px)',
                    flexShrink: 0
                }}>
                    <Zap size={18} style={{ color: '#6366f1' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}>{credits}</span>
                        <span style={{ color: '#9ca3af', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credits left</span>
                    </div>
                    <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ color: '#818cf8', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}>{MODES.find(m => m.id === mode)?.cost ?? 1}</span>
                        <span style={{ color: '#9ca3af', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost</span>
                    </div>
                </div>
            </div>

            {/* Mode Selection Tabs */}
            <div className="mode-tabs" style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '0.75rem',
                padding: '0.25rem',
                marginBottom: '2rem',
                gap: '0.25rem',
                overflowX: 'auto'
            }}>
                {MODES.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            background: mode === m.id ? '#6366f1' : 'transparent',
                            color: mode === m.id ? 'white' : '#9ca3af',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <m.icon size={16} />
                        {t(m.label as any)}
                    </button>
                ))}
            </div>

            <div className="generate-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                {/* Left Column - Input */}
                <div>

                    {/* Image Upload (for Img2Img / Inpaint / Upscale) */}
                    {(mode !== "txt2img") && (
                        <div style={cardStyle}>
                            <label style={labelStyle}>
                                <Upload size={16} color="#fbbf24" />
                                Input Image
                            </label>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: '2px dashed rgba(255,255,255,0.1)',
                                    borderRadius: '0.75rem',
                                    padding: '2rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1rem',
                                    cursor: 'pointer',
                                    background: inputImage ? 'black' : 'rgba(0,0,0,0.2)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minHeight: '200px'
                                }}
                            >
                                {inputImage ? (
                                    <img src={inputImage} alt="Input" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
                                ) : (
                                    <>
                                        <Upload size={32} color="#9ca3af" />
                                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Click to upload image</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(e, "image")}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {mode === "upscale" && (
                                <div style={{ marginTop: '1rem' }}>
                                    <label style={labelStyle}>Scale Factor</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {[1.5, 2, 4].map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setUpscaleFactor(f)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    borderRadius: '0.5rem',
                                                    border: 'none',
                                                    backgroundColor: upscaleFactor === f ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                {f}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(mode === "img2img" || mode === "upscale") && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Denoising Strength</label>
                                        <span style={{ fontSize: '0.875rem', color: 'white' }}>{denoisingStrength}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0} max={1} step={0.05}
                                        value={denoisingStrength}
                                        onChange={(e) => setDenoisingStrength(Number(e.target.value))}
                                        style={{ width: '100%', accentColor: '#fbbf24' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                        {mode === "upscale" ? "Lower = Sharper original, Higher = AI adds more detail" : "Lower = closer to original, Higher = more creative"}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Model Selection */}
                    {(mode === "txt2img" || mode === "img2img" || mode === "inpaint") && (
                        <div style={cardStyle}>
                            <label style={labelStyle}>
                                <Layers size={16} color="#8b5cf6" />
                                Base Model
                            </label>
                            <select
                                value={selectedModel?.id || ""}
                                onChange={(e) => {
                                    const model = availableModels.find(m => m.id === e.target.value);
                                    setSelectedModel(model);
                                    // Auto-adjust resolution for SDXL
                                    if (model?.base_model === 'sdxl' || model?.metadata?.architecture === 'sdxl') {
                                        const square = ASPECT_RATIOS.find(a => a.label === "1:1");
                                        if (square) setSelectedAspect(square);
                                    }
                                }}
                                disabled={isGenerating}
                                style={{
                                    ...inputStyle,
                                    opacity: isGenerating ? 0.5 : 1,
                                    cursor: isGenerating ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {availableModels.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} {(m.base_model === 'sdxl' || m.metadata?.architecture === 'sdxl') ? '(SDXL)' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedModel?.base_model === 'sdxl' && (
                                <p style={{ fontSize: '0.75rem', color: '#8b5cf6', marginTop: '0.5rem' }}>
                                    ✨ SDXL is optimized for 1024x1024 resolutions.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Mask Upload (for Inpaint) */}
                    {mode === "inpaint" && (
                        <div style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>
                                    <Brain size={18} color="#8b5cf6" />
                                    Masking Strategy
                                </label>
                                <div style={{
                                    display: 'flex',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '0.5rem',
                                    padding: '0.25rem'
                                }}>
                                    <button
                                        onClick={() => setIsAutoMask(true)}
                                        style={{
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: isAutoMask ? '#8b5cf6' : 'transparent',
                                            color: isAutoMask ? 'white' : '#9ca3af',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Auto (Smart AI)
                                    </button>
                                    <button
                                        onClick={() => setIsAutoMask(false)}
                                        style={{
                                            padding: '0.375rem 0.75rem',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: !isAutoMask ? '#6366f1' : 'transparent',
                                            color: !isAutoMask ? 'white' : '#9ca3af',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Manual Upload
                                    </button>
                                </div>
                            </div>

                            {isAutoMask ? (
                                <div style={{
                                    padding: '1.25rem',
                                    borderRadius: '0.75rem',
                                    background: 'rgba(139, 92, 246, 0.05)',
                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '2.5rem',
                                            height: '2.5rem',
                                            borderRadius: '0.5rem',
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Zap size={20} color="#a78bfa" />
                                        </div>
                                        <div>
                                            <h4 style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Smart Auto-Mask</h4>
                                            <p style={{ color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1.5 }}>
                                                Just describe what you want in the prompt — the system will automatically detect what to change using AI. No manual masking needed!
                                            </p>

                                            <div style={{ marginTop: '1rem' }}>
                                                <label style={{ ...labelStyle, fontSize: '0.75rem', marginBottom: '0.5rem' }}>What to Auto-Mask (Optional Override)</label>
                                                <input
                                                    type="text"
                                                    value={maskPrompt}
                                                    onChange={(e) => setMaskPrompt(e.target.value)}
                                                    placeholder="e.g. 'face', 'background', 'space suit', 'shirt and pants'"
                                                    style={{ ...inputStyle, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                                                />
                                                <p style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                                                    If blank, the AI strictly uses your Positive and Negative prompts to hunt for objects.
                                                </p>
                                            </div>

                                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                                                <p style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.25rem' }}>✅ Good prompt examples:</p>
                                                <p style={{ color: '#a78bfa', fontSize: '0.7rem' }}>&quot;casual pink t-shirt and blue jeans, modern outfit&quot;</p>
                                                <p style={{ color: '#a78bfa', fontSize: '0.7rem' }}>&quot;blonde wavy hairstyle, natural look&quot;</p>
                                                <p style={{ color: '#a78bfa', fontSize: '0.7rem' }}>&quot;tropical beach background, sunny day&quot;</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => maskInputRef.current?.click()}
                                    style={{
                                        border: '2px dashed rgba(255,255,255,0.1)',
                                        borderRadius: '0.75rem',
                                        padding: '2rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '1rem',
                                        cursor: 'pointer',
                                        background: maskImage ? 'black' : 'rgba(0,0,0,0.2)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        minHeight: '200px'
                                    }}
                                >
                                    {maskImage ? (
                                        <img src={maskImage} alt="Mask" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
                                    ) : (
                                        <>
                                            <Brush size={32} color="#9ca3af" />
                                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Click to upload mask (white = change)</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        ref={maskInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, "mask")}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Prompt Input */}
                    <div style={cardStyle}>
                        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Sparkles style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
                                {t('promptLabelUI')}  {mode === 'upscale' && t('promptOptionalTitle')}
                            </div>
                            <VoiceInput onTranscript={(text) => setPrompt((prev) => prev ? prev + " " + text : text)} />
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={mode === 'inpaint'
                                ? "Describe what you want the changed area to look like, e.g.: 'casual pink t-shirt and blue jeans, modern western outfit, natural fabric texture'"
                                : mode === 'upscale'
                                    ? "Optional: add details to enhance during upscale..."
                                    : "A majestic dragon soaring through a cyberpunk city at sunset, neon lights reflecting off its scales, cinematic lighting, highly detailed, 8k..."}
                            style={{ ...textAreaStyle, height: '8rem', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {prompt.length} characters
                            </span>
                            <button
                                onClick={() => handleEnhancePrompt("positive")}
                                disabled={isEnhancingPositive || !prompt.trim()}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    color: 'white',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '0.25rem',
                                    cursor: isEnhancingPositive || !prompt.trim() ? 'not-allowed' : 'pointer',
                                    opacity: isEnhancingPositive || !prompt.trim() ? 0.5 : 1
                                }}>
                                {isEnhancingPositive ? <Loader2 className="animate-spin" style={{ width: '0.75rem', height: '0.75rem' }} /> : <Wand2 style={{ width: '0.75rem', height: '0.75rem' }} />}
                                Enhance prompt (Smart AI)
                            </button>
                        </div>
                    </div>

                    {/* Negative Prompt */}
                    <div style={cardStyle}>
                        <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                            <div>🚫 {t('negativePromptLabel')}</div>
                            <VoiceInput onTranscript={(text) => setNegativePrompt((prev) => prev ? prev + " " + text : text)} />
                        </label>
                        <textarea
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder={mode === 'inpaint'
                                ? "blurry, low quality, distorted, bad anatomy, extra limbs, deformed, artifacts"
                                : "blurry, low quality, distorted, ugly, bad anatomy..."}
                            style={{ ...textAreaStyle, height: '5rem', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {negativePrompt.length} characters
                            </span>
                            <button
                                onClick={() => handleEnhancePrompt("negative")}
                                disabled={isEnhancingNegative || !negativePrompt.trim()}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    color: 'white',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '0.25rem',
                                    cursor: isEnhancingNegative || !negativePrompt.trim() ? 'not-allowed' : 'pointer',
                                    opacity: isEnhancingNegative || !negativePrompt.trim() ? 0.5 : 1
                                }}>
                                {isEnhancingNegative ? <Loader2 className="animate-spin" style={{ width: '0.75rem', height: '0.75rem' }} /> : <Wand2 style={{ width: '0.75rem', height: '0.75rem' }} />}
                                Enhance prompt (Smart AI)
                            </button>
                        </div>
                        {mode === 'inpaint' && !negativePrompt && (
                            <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                💡 Tip: Leave empty for smart auto-negative, or add terms like the original clothing type to avoid artifacts
                            </p>
                        )}
                    </div>

                    {/* Aspect Ratio (Only for Txt2Img usually) */}
                    {(mode === "txt2img") && (
                        <div style={cardStyle}>
                            <label style={labelStyle}>
                                Aspect Ratio
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                {ASPECT_RATIOS.map((ratio) => (
                                    <button
                                        key={ratio.label}
                                        onClick={() => setSelectedAspect(ratio)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: selectedAspect.label === ratio.label ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                                            color: selectedAspect.label === ratio.label ? 'white' : '#9ca3af',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {ratio.label}
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {selectedAspect.width} × {selectedAspect.height} px
                            </p>
                        </div>
                    )}

                    {/* Advanced Settings Toggle */}
                    {mode !== "upscale" && (
                        <>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginBottom: '1rem',
                                    padding: 0
                                }}
                            >
                                <Settings2 style={{ width: '1rem', height: '1rem' }} />
                                {showAdvanced ? "Hide" : "Show"} Advanced Settings
                            </button>

                            {/* Advanced Settings */}
                            {showAdvanced && (
                                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {/* Sampler */}
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>{t('samplerTitle')}</label>
                                        <select
                                            value={sampler}
                                            onChange={(e) => setSampler(e.target.value)}
                                            style={inputStyle}
                                        >
                                            {SAMPLERS.map((s) => (
                                                <option key={s} value={s} style={{ backgroundColor: '#1e1b4b' }}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Steps */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <label style={labelStyle}>Steps</label>
                                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{steps}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1}
                                            max={150}
                                            value={steps}
                                            onChange={(e) => setSteps(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#6366f1' }}
                                        />
                                    </div>

                                    {/* CFG Scale */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <label style={labelStyle}>CFG Scale</label>
                                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{cfgScale}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1}
                                            max={30}
                                            step={0.5}
                                            value={cfgScale}
                                            onChange={(e) => setCfgScale(Number(e.target.value))}
                                            style={{ width: '100%', accentColor: '#6366f1' }}
                                        />
                                    </div>

                                    {/* Seed */}
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Seed</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                                                    padding: '0 0.75rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    background: 'transparent',
                                                    color: 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Shuffle style={{ width: '1rem', height: '1rem' }} />
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                            -1 for random seed
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isUploading || ((mode === "txt2img" || mode === "t2v") && !prompt.trim()) || ((mode === "img2img" || mode === "upscale" || mode === "i2v") && !inputImage)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            border: 'none',
                            cursor: (isGenerating || isUploading || ((mode === "txt2img" || mode === "t2v") && !prompt.trim()) || ((mode === "img2img" || mode === "upscale" || mode === "i2v") && !inputImage)) ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            color: 'white',
                            opacity: (isGenerating || isUploading || ((mode === "txt2img" || mode === "t2v") && !prompt.trim()) || ((mode === "img2img" || mode === "upscale" || mode === "i2v") && !inputImage)) ? 0.7 : 1,
                            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.3)',
                            marginBottom: '1rem'
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" style={{ width: '1.25rem', height: '1.25rem' }} />
                                Generating...
                            </>
                        ) : isUploading ? (
                            <>
                                <Loader2 className="animate-spin" style={{ width: '1.25rem', height: '1.25rem' }} />
                                Uploading Image...
                            </>
                        ) : (
                            <>
                                <Sparkles style={{ width: '1.25rem', height: '1.25rem' }} />
                                Generate
                            </>
                        )}
                    </button>

                    {isGenerating && (
                        <button
                            onClick={handleResetUI}
                            style={{
                                width: '100%',
                                marginTop: '0.75rem',
                                padding: '0.5rem',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '0.5rem',
                                color: '#9ca3af',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            {t('stopResetUILabel')}
                        </button>
                    )}

                    <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#9ca3af' }}>
                        {t('cost')}: {MODES.find(m => m.id === mode)?.cost ?? 1} • {credits} {t('creditsRemaining')}
                    </p>
                </div>

                {/* Right Column - Preview */}
                <div className="generate-preview" style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                    <div style={{
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        overflow: 'hidden'
                    }}>
                        {/* Preview Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white' }}>Preview</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    onClick={() => enterpriseToast.info("Tip", "Use the trash icon in 'Recent Generations' below to delete images.")}
                                    disabled={!generatedImage}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: generatedImage ? '#ef4444' : '#9ca3af',
                                        cursor: generatedImage ? 'pointer' : 'not-allowed',
                                        padding: '0.25rem'
                                    }}
                                    title="Delete Generation"
                                >
                                    <Trash2 style={{ width: '1.1rem', height: '1.1rem' }} />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    disabled={!generatedImage}
                                    style={{ background: 'transparent', border: 'none', color: generatedImage ? 'white' : '#9ca3af', cursor: generatedImage ? 'pointer' : 'not-allowed' }}
                                    title="Download Image"
                                >
                                    <Download style={{ width: '1rem', height: '1rem' }} />
                                </button>
                                <button
                                    onClick={handleShare}
                                    disabled={!generatedImage}
                                    style={{ background: 'transparent', border: 'none', color: generatedImage ? 'white' : '#9ca3af', cursor: generatedImage ? 'pointer' : 'not-allowed' }}
                                    title="Share Image"
                                >
                                    <Share2 style={{ width: '1rem', height: '1rem' }} />
                                </button>
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div
                            style={{
                                position: 'relative',
                                backgroundColor: 'rgba(15, 15, 35, 0.3)',
                                aspectRatio: (mode === 'txt2img' || mode === 't2v' || mode === 'i2v') ? `${selectedAspect.width}/${selectedAspect.height}` : 'auto',
                                minHeight: '350px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}
                        >
                            {isGenerating ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    padding: '2rem',
                                    background: (mode === "t2v" || mode === "i2v") ? 'radial-gradient(circle at center, rgba(168, 85, 247, 0.05) 0%, transparent 70%)' : 'transparent'
                                }}>
                                    {(mode === "t2v" || mode === "i2v") ? (
                                        /* Specialized Video Loader */
                                        <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '2rem' }}>
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                borderRadius: '20px',
                                                border: '2px dashed #a855f7',
                                                animation: 'pulse-slow 2s infinite',
                                                opacity: 0.5
                                            }} />
                                            <div style={{
                                                position: 'absolute',
                                                inset: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#a855f7'
                                            }}>
                                                <Film size={48} style={{ animation: 'shimmer 1.5s infinite' }} />
                                            </div>
                                            {/* Rotating Frame Indicators */}
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                border: '4px solid transparent',
                                                borderTopColor: '#a855f7',
                                                borderBottomColor: '#6366f1',
                                                borderRadius: '50%',
                                                animation: 'spin 3s linear infinite'
                                            }} />
                                        </div>
                                    ) : (
                                        /* Standard Image Loader */
                                        <div style={{ position: 'relative', width: '5rem', height: '5rem', marginBottom: '1.5rem' }}>
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                borderRadius: '50%',
                                                border: '3px solid rgba(99, 102, 241, 0.1)',
                                                borderTopColor: '#6366f1',
                                                animation: 'spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                                            }} />
                                            <div style={{
                                                position: 'absolute',
                                                inset: '4px',
                                                borderRadius: '50%',
                                                border: '3px solid rgba(168, 85, 247, 0.1)',
                                                borderBottomColor: '#a855f7',
                                                animation: 'spin 2s cubic-bezier(0.4, 0, 0.2, 1) reverse infinite'
                                            }} />
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold',
                                                color: 'white'
                                            }}>
                                                {progress}%
                                            </div>
                                        </div>
                                    )}

                                    <h3 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        marginBottom: '0.5rem',
                                        background: (mode === "t2v" || mode === "i2v") ? 'linear-gradient(to right, #a855f7, #6366f1)' : 'transparent',
                                        WebkitBackgroundClip: (mode === "t2v" || mode === "i2v") ? 'text' : 'unset',
                                        WebkitTextFillColor: (mode === "t2v" || mode === "i2v") ? 'transparent' : 'white',
                                        color: 'white'
                                    }}>
                                        {statusMessage || ((mode === "t2v" || mode === "i2v") ? "Rendering Cinematic Video..." : "Processing Image...")}
                                    </h3>

                                    <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1rem', marginBottom: '2rem', textAlign: 'center', maxWidth: '300px' }}>
                                        {(mode === "t2v" || mode === "i2v")
                                            ? "Wan 2.1 is calculating motion and temporal consistency..."
                                            : "Please wait while your AI artwork is being generated..."
                                        }
                                    </p>

                                    <div style={{
                                        width: '100%',
                                        maxWidth: '24rem',
                                        height: '8px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: (mode === "t2v" || mode === "i2v")
                                                ? 'linear-gradient(90deg, #a855f7, #6366f1, #a855f7)'
                                                : 'linear-gradient(90deg, #6366f1, #a855f7)',
                                            backgroundSize: '200% 100%',
                                            animation: (mode === "t2v" || mode === "i2v") ? 'gradient-move 2s linear infinite' : 'none',
                                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: (mode === "t2v" || mode === "i2v") ? '0 0 20px rgba(168, 85, 247, 0.6)' : '0 0 15px rgba(99, 102, 241, 0.6)'
                                        }} />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: (mode === "t2v" || mode === "i2v") ? '#a855f7' : '#6366f1', fontSize: '0.875rem', fontWeight: 700 }}>
                                            {progress}%
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                                            •
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            {(mode === "t2v" || mode === "i2v") ? "Temporal Synthesis" : "Pixel Diffusion"}
                                        </span>
                                    </div>

                                    <style jsx>{`
                                        @keyframes spin {
                                            from { transform: rotate(0deg); }
                                            to { transform: rotate(360deg); }
                                        }
                                        @keyframes pulse-slow {
                                            0%, 100% { opacity: 0.3; transform: scale(1); }
                                            50% { opacity: 0.6; transform: scale(1.05); }
                                        }
                                        @keyframes shimmer {
                                            0% { filter: brightness(1); }
                                            50% { filter: brightness(1.5); }
                                            100% { filter: brightness(1); }
                                        }
                                        @keyframes gradient-move {
                                            0% { background-position: 0% 50%; }
                                            100% { background-position: 200% 50%; }
                                        }
                                    `}</style>
                                </div>
                            ) : generatedImage ? (
                                (generatedImage.toLowerCase().split('?')[0].endsWith('.mp4') || generatedImage.toLowerCase().split('?')[0].endsWith('.webm')) ? (
                                    <video
                                        src={generatedImage}
                                        controls
                                        autoPlay
                                        loop
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <img
                                        src={generatedImage}
                                        alt="Generated artwork"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    />
                                )
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                                    <ImageIcon style={{ width: '4rem', height: '4rem', marginBottom: '1rem', opacity: 0.5 }} />
                                    <p style={{ fontSize: '0.875rem' }}>Your generated image will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Generation Info */}
                    {generatedImage && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'white' }}>Generation Settings</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                                <div>Size: {selectedAspect.width}×{selectedAspect.height}</div>
                                <div>Steps: {steps}</div>
                                <div>Sampler: {sampler}</div>
                                <div>CFG: {cfgScale}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Generations Section */}
            <div style={{ marginTop: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>Recent Generations</h2>
                    <button
                        onClick={() => window.location.href = '/dashboard/gallery'}
                        style={{
                            fontSize: '0.875rem',
                            color: '#6366f1',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        View All
                    </button>
                </div>

                <ActiveJobsList refreshKey={refreshKey} />
                <RecentGenerationsGrid refreshKey={refreshKey} />
            </div>
        </div>
    );
}

function ActiveJobsList({ refreshKey }: { refreshKey: number }) {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { lastUpdate } = useJobRealtime();

    const fetchJobs = async () => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('jobs')
                .select('*')
                .eq('user_id', user.id)
                .in('status', ['pending', 'queued', 'processing'])
                .order('created_at', { ascending: false });

            if (data) setJobs(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchJobs();
    }, [refreshKey, lastUpdate]);

    const handleCancel = async (jobId: string) => {
        const ok = await styledConfirm({ title: "Cancel Job?", message: "This will cancel and remove this job from the queue.", confirmLabel: "Cancel Job", variant: "danger" });
        if (!ok) return;
        try {
            const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Unknown error");
            }
            setJobs(prev => prev.filter(j => j.id !== jobId));
        } catch (e: any) {
            console.error(e);
            enterpriseToast.error("Cancel Failed", e.message);
        }
    };

    const handleClearAll = async () => {
        const ok = await styledConfirm({ title: "Clear All Jobs?", message: "This will delete ALL pending and active jobs. This cannot be undone.", confirmLabel: "Clear All", variant: "danger" });
        if (!ok) return;
        try {
            const res = await fetch(`/api/jobs/all`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Unknown error");
            }
            setJobs([]);
        } catch (e: any) {
            console.error(e);
            enterpriseToast.error("Clear Failed", e.message);
        }
    };

    if (loading || jobs.length === 0) return null;

    return (
        <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Loader2 className="animate-spin" size={20} color="#6366f1" />
                    Active Queue ({jobs.length})
                </h2>
                <button
                    onClick={handleClearAll}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    Clear All Pending
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {jobs.map(job => (
                    <div key={job.id} style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    backgroundColor: job.status === 'processing' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                    color: job.status === 'processing' ? '#818cf8' : '#9ca3af',
                                    textTransform: 'uppercase',
                                    fontWeight: 600
                                }}>
                                    {job.status}
                                </span>
                                <span style={{ color: '#d1d5db', fontWeight: 500, fontSize: '0.9rem' }}>
                                    {job.type.toUpperCase()}
                                </span>
                            </div>
                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                                {job.params?.prompt ? job.params.prompt.substring(0, 60) + "..." : "No prompt"}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {job.status === 'processing' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${job.progress || 0}%`, height: '100%', background: '#6366f1' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>{job.progress}%</span>
                                </div>
                            )}
                            <button
                                onClick={() => handleCancel(job.id)}
                                style={{
                                    padding: '0.4rem',
                                    borderRadius: '0.5rem',
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    color: '#ef4444',
                                    cursor: 'pointer'
                                }}
                                title="Cancel Job"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RecentGenerationsGrid({ refreshKey }: { refreshKey: number }) {
    const [recent, setRecent] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [localRefresh, setLocalRefresh] = useState(0);
    const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

    useEffect(() => {
        const fetchRecent = async () => {
            setLoading(true);
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('assets')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('type', activeTab)
                    .order('created_at', { ascending: false })
                    .limit(6);

                if (data) setRecent(data);
                else setRecent([]);
            }
            setLoading(false);
        };
        fetchRecent();
    }, [refreshKey, localRefresh, activeTab]);

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, assetId: string) => {
        e.stopPropagation();
        const ok = await styledConfirm({ title: "Delete Generation?", message: "This will permanently delete this generation. This cannot be undone.", confirmLabel: "Delete", variant: "danger" });
        if (!ok) return;

        // Optimistic UI Update
        const previousRecent = [...recent];
        setRecent(prev => prev.filter(item => item.id !== assetId));
        setDeletingId(assetId);

        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Use the enterprise unified generations endpoint
            const response = await fetch(`/api/generations/${assetId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Deletion failed");
            }

            console.log(`[RecentGrid] Successfully deleted asset ${assetId}`);
        } catch (error: any) {
            console.error("Delete failed:", error);
            // Rollback optimistic update
            setRecent(previousRecent);
            enterpriseToast.error("Delete Failed", error.message);
        } finally {
            setDeletingId(assetId === deletingId ? null : deletingId);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Tab Switcher */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                padding: '0.25rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '0.75rem',
                width: 'fit-content'
            }}>
                <button
                    onClick={() => setActiveTab('image')}
                    style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        backgroundColor: activeTab === 'image' ? '#6366f1' : 'transparent',
                        color: activeTab === 'image' ? 'white' : '#9ca3af',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <ImageIcon size={16} />
                    Images
                </button>
            </div>

            {loading ? (
                <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px', padding: '2rem 0' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Scanning {activeTab} library...
                </div>
            ) : recent.length === 0 ? (
                <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '1rem',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    color: '#6b7280'
                }}>
                    <p>No {activeTab}s found in your recent history.</p>
                </div>
            ) : (
                <div className="recent-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {recent.map((gen) => (
                        <div
                            key={gen.id}
                            style={{
                                borderRadius: '0.75rem',
                                overflow: 'hidden',
                                aspectRatio: '1/1',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                cursor: 'default',
                                transition: 'all 0.3s ease',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.borderColor = activeTab === 'video' ? '#a855f7' : '#6366f1';
                                e.currentTarget.style.boxShadow = activeTab === 'video' ? '0 10px 25px -5px rgba(168, 85, 247, 0.3)' : '0 10px 25px -5px rgba(99, 102, 241, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {activeTab === 'video' ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
                                    <video
                                        src={gen.file_path}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                                        muted
                                        onMouseEnter={(e) => e.currentTarget.play()}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.pause();
                                            e.currentTarget.currentTime = 0;
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        left: '10px',
                                        padding: '4px 8px',
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        backdropFilter: 'blur(4px)',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        zIndex: 2
                                    }}>
                                        <Film size={10} />
                                        VIDEO
                                    </div>
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 1,
                                        pointerEvents: 'none'
                                    }}>
                                        <Video size={32} color="white" style={{ opacity: 0.5 }} />
                                    </div>
                                </div>
                            ) : (
                                <img
                                    src={gen.file_path}
                                    alt={gen.prompt}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}

                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)',
                                opacity: 0,
                                transition: 'opacity 0.3s ease',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                zIndex: 10
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => handleDelete(e, gen.id)}
                                        disabled={deletingId === gen.id}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            color: '#ef4444',
                                            padding: '0.4rem',
                                            borderRadius: '0.5rem',
                                            cursor: deletingId === gen.id ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            opacity: deletingId === gen.id ? 1 : 0.8
                                        }}
                                        onMouseEnter={(e) => {
                                            if (deletingId !== gen.id) {
                                                e.currentTarget.style.background = '#ef4444';
                                                e.currentTarget.style.color = 'white';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (deletingId !== gen.id) {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                e.currentTarget.style.color = '#ef4444';
                                            }
                                        }}
                                        title="Delete Generation"
                                    >
                                        {deletingId === gen.id ? (
                                            <Loader2 style={{ width: '0.9rem', height: '0.9rem' }} className="animate-spin" />
                                        ) : (
                                            <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                                        )}
                                    </button>
                                </div>
                                <p style={{
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {gen.prompt}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
