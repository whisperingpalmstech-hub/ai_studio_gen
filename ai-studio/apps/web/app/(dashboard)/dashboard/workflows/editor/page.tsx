"use client";

import { useCallback, useState, useEffect, Suspense } from 'react';
import { useI18n } from '@/lib/i18n';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, Download, Upload } from 'lucide-react';
import {
    LoadModelNode,
    PromptNode,
    SamplerNode,
    OutputNode,
    LoRANode,
    UpscaleNode,
    LoadImageNode,
    ControlNetNode,
    EmptyLatentImageNode,
    VAEEncodeNode,
    VAEDecodeNode,
    FaceSwapNode,
    InpaintNode,
    LatentUpscaleNode,
    ConditioningAverageNode,
    SVDLoaderNode,
    VideoLinearCFGNode,
    ClipVisionLoaderNode,
    VideoCombineNode,
    WanLoaderNode,
    UNETLoaderNode,
    CLIPLoaderNode,
    VAELoaderNode,
    CLIPVisionEncodeNode,
    WanVideoSamplerNode,
    WanEmptyLatentNode,
    GroundingDinoLoaderNode,
    SAMModelLoaderNode,
    GroundingDinoSAMSegmentNode,
    MaskRefineNode,
    InpaintConditioningNode
} from '@/components/workflow/CustomNodes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useWebSocket } from '@/lib/useWebSocket';
import { WORKFLOW_TEMPLATES } from '@/lib/workflow-templates';

const nodeTypes = {
    loadModel: LoadModelNode,
    prompt: PromptNode,
    sampler: SamplerNode,
    output: OutputNode,
    lora: LoRANode,
    upscale: UpscaleNode,
    loadImage: LoadImageNode,
    controlNet: ControlNetNode,
    emptyLatent: EmptyLatentImageNode,
    vaeEncode: VAEEncodeNode,
    vaeDecode: VAEDecodeNode,
    faceSwap: FaceSwapNode,
    inpaint: InpaintNode,
    latentUpscale: LatentUpscaleNode,
    conditioningAverage: ConditioningAverageNode,
    svdLoader: SVDLoaderNode,
    videoLinearCFG: VideoLinearCFGNode,
    videoCombine: VideoCombineNode,
    clipVision: ClipVisionLoaderNode,
    wanI2V: WanLoaderNode,
    unetLoader: UNETLoaderNode,
    clipLoader: CLIPLoaderNode,
    vaeLoader: VAELoaderNode,
    clipVisionEncode: CLIPVisionEncodeNode,
    wanT2V: WanVideoSamplerNode,
    wanEmptyLatent: WanEmptyLatentNode,
    groundingDinoLoader: GroundingDinoLoaderNode,
    samModelLoader: SAMModelLoaderNode,
    groundingDinoSAMSegment: GroundingDinoSAMSegmentNode,
    maskRefine: MaskRefineNode,
    inpaintConditioning: InpaintConditioningNode
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'loadModel',
        position: { x: 50, y: 100 },
        data: { label: 'Load Checkpoint' }
    },
    {
        id: '2',
        type: 'prompt',
        position: { x: 50, y: 250 },
        data: { label: 'Prompt' }
    },
    {
        id: '3',
        type: 'sampler',
        position: { x: 350, y: 150 },
        data: { label: 'Sampler' }
    },
    {
        id: '4',
        type: 'output',
        position: { x: 650, y: 175 },
        data: { label: 'Output' }
    },
];

const initialEdges: Edge[] = [
    { id: 'e1-3', source: '1', target: '3', animated: true },
    { id: 'e2-3', source: '2', target: '3', animated: true },
    { id: 'e3-4', source: '3', target: '4', animated: true },
];

function WorkflowEditorContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const workflowId = searchParams.get('id');
    const router = useRouter();
    const { getNodes, getEdges, setNodes: rfSetNodes, setEdges: rfSetEdges } = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState(workflowId ? [] : initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(workflowId ? [] : initialEdges);
    const [workflowName, setWorkflowName] = useState('Untitled Workflow');
    const [loading, setLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });

    // Model state
    const [checkpoints, setCheckpoints] = useState<any[]>([]);
    const [loras, setLoras] = useState<any[]>([]);
    const [controlnets, setControlnets] = useState<any[]>([]);

    const { lastMessage } = useWebSocket();
    const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [activeTemplate, setActiveTemplate] = useState<any>(null);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // PRIMARY channel: Supabase Realtime (works even without API server)
    useEffect(() => {
        if (!activeJobId) return;

        const supabase = getSupabaseClient();
        const channel = supabase
            .channel(`workflow-job-${activeJobId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'jobs',
                    filter: `id=eq.${activeJobId}`
                },
                (payload) => {
                    const job = payload.new as any;
                    console.log(`🔄 Realtime job update: status=${job.status}, node=${job.current_node}, progress=${job.progress}%`);

                    if (job.status === 'processing') {
                        const nodeId = job.current_node;
                        const progress = job.progress;

                        if (nodeId) {
                            setExecutingNodeId(nodeId);
                        }
                        if (nodeId && progress !== undefined) {
                            setNodes((nds) => nds.map((n) =>
                                n.id === nodeId ? { ...n, data: { ...n.data, progress } } : n
                            ));
                        }
                    } else if (job.status === 'completed') {
                        console.log('✅ Job completed via Realtime');
                        setExecutingNodeId(null);
                        setActiveJobId(null);

                        // Extract nodeResults from structured outputs
                        const outputs = job.outputs;
                        const nodeResults = outputs?.nodeResults || outputs?.node_results || null;

                        if (nodeResults) {
                            setNodes((nds) => nds.map((node) => {
                                const nodeResultArray = nodeResults[node.id];
                                if (nodeResultArray && nodeResultArray.length > 0) {
                                    const result = nodeResultArray[0];
                                    if (result.type === 'video') {
                                        return {
                                            ...node,
                                            data: { ...node.data, preview: `${result.url}?t=${Date.now()}` }
                                        };
                                    } else {
                                        return {
                                            ...node,
                                            data: { ...node.data, image: `${result.url}?t=${Date.now()}` }
                                        };
                                    }
                                }
                                return node;
                            }));
                        }
                        showNotification(t("workflowCompleted"));
                    } else if (job.status === 'failed') {
                        setExecutingNodeId(null);
                        setActiveJobId(null);
                        showNotification(job.error_message || 'Job Failed', 'error');
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📡 Realtime subscription status: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeJobId]);

    // SECONDARY channel: WebSocket (works when API server is running)
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'job_progress') {
            const nodeId = lastMessage.nodeId;
            const progress = lastMessage.progress;
            if (nodeId) setExecutingNodeId(nodeId);
            if (nodeId && progress !== undefined) {
                setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, progress } } : n));
            }
        } else if (lastMessage.type === 'job_complete') {
            console.log("Job Complete (WS):", lastMessage);
            setExecutingNodeId(null);

            if (lastMessage.results) {
                setNodes((nds) => nds.map((node) => {
                    const nodeResultArray = lastMessage.results[node.id];
                    if (nodeResultArray && nodeResultArray.length > 0) {
                        const result = nodeResultArray[0];
                        if (result.type === 'video') {
                            return {
                                ...node,
                                data: { ...node.data, preview: `${result.url}?t=${Date.now()}` }
                            };
                        } else {
                            return {
                                ...node,
                                data: { ...node.data, image: `${result.url}?t=${Date.now()}` }
                            };
                        }
                    }
                    return node;
                }));
            }
        } else if (lastMessage.type === 'job_failed') {
            setExecutingNodeId(null);
            showNotification(lastMessage.error || 'Job Failed', 'error');
        }
    }, [lastMessage]);

    // Update nodes to reflect executing state
    useEffect(() => {
        setNodes((nds) => nds.map((node) => ({
            ...node,
            data: { ...node.data, executing: node.id === executingNodeId }
        })));
    }, [executingNodeId]);

    const fetchModels = async () => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        let query = supabase
            .from("models")
            .select("*")
            .order("name", { ascending: true });

        if (user) {
            query = query.or(`user_id.eq.${user.id},is_public.eq.true,is_system.eq.true`);
        } else {
            query = query.or(`is_public.eq.true,is_system.eq.true`);
        }

        const { data: models, error } = await query;

        if (error) {
            console.error("Error fetching models:", error);
            return { checkpoints: [], loras: [], controlnets: [] };
        }

        console.log("Fetched models count:", models?.length || 0);

        if (models) {
            const fetchedCheckpoints = models.filter((m: any) => m.type?.toLowerCase() === 'checkpoint');
            const fetchedLoras = models.filter((m: any) => m.type?.toLowerCase() === 'lora');
            const fetchedControlnets = models.filter((m: any) => m.type?.toLowerCase() === 'controlnet');

            console.log("Checkpoints found:", fetchedCheckpoints.length);

            setCheckpoints(fetchedCheckpoints);
            setLoras(fetchedLoras);
            setControlnets(fetchedControlnets);

            // Update existing nodes with model lists
            setNodes((prevNodes) => prevNodes.map((node: any) => {
                if (node.type === 'loadModel') {
                    return { ...node, data: { ...node.data, models: fetchedCheckpoints } };
                }
                if (node.type === 'lora') {
                    return { ...node, data: { ...node.data, loras: fetchedLoras } };
                }
                if (node.type === 'controlNet') {
                    return { ...node, data: { ...node.data, controlnets: fetchedControlnets } };
                }
                return node;
            }));
            return { checkpoints: fetchedCheckpoints, loras: fetchedLoras, controlnets: fetchedControlnets };
        }
        return { checkpoints: [], loras: [], controlnets: [] };
    };

    const loadWorkflow = async (id: string, currentModels?: any) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/workflows/${id}`);
            const data = await response.json();
            if (data.workflow) {
                setWorkflowName(data.workflow.name);

                // Match with template to show guide
                const template = WORKFLOW_TEMPLATES.find(t => t.name === data.workflow.name);
                if (template) setActiveTemplate(template);

                const activeCheckpoints = currentModels?.checkpoints || checkpoints;
                const activeLoras = currentModels?.loras || loras;
                const activeControlnets = currentModels?.controlnets || controlnets;

                // Ensure nodes get current model lists when loaded
                const hydratedNodes = (data.workflow.nodes || []).map((node: any) => {
                    if (node.type === 'loadModel') return { ...node, data: { ...node.data, models: activeCheckpoints } };
                    if (node.type === 'lora') return { ...node, data: { ...node.data, loras: activeLoras } };
                    if (node.type === 'controlNet') return { ...node, data: { ...node.data, controlnets: activeControlnets } };
                    return node;
                });
                setNodes(hydratedNodes);
                setEdges(data.workflow.edges || []);
            }
        } catch (error) {
            console.error("Failed to load workflow:", error);
            showNotification("Failed to load workflow", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const models = await fetchModels();
            if (workflowId) {
                loadWorkflow(workflowId, models);
            }
        };
        init();
    }, [workflowId]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    );

    const addNode = (type: string, position?: { x: number, y: number }) => {
        const newNode: Node = {
            id: `${Date.now()}`,
            type,
            position: position || { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
                label: type,
                models: type === 'loadModel' ? checkpoints : undefined,
                loras: type === 'lora' ? loras : undefined,
                controlnets: type === 'controlNet' ? controlnets : undefined
            }
        };
        setNodes((nds) => [...nds, newNode]);
        setSearchOpen(false);
        setSearchQuery('');
    };

    const [saved, setSaved] = useState(false);

    const saveWorkflow = async () => {
        try {
            // Get current state from ReactFlow store to ensure we have latest data from nodes
            const currentNodes = getNodes();
            const currentEdges = getEdges();

            const workflow = {
                name: workflowName,
                description: 'Created in AI Studio',
                nodes: currentNodes,
                edges: currentEdges,
            };

            const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
            const method = workflowId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workflow)
            });

            if (!response.ok) throw new Error('Failed to save workflow');

            const data = await response.json();

            if (!workflowId && data.workflow?.id) {
                // If we just created it, update URL so future saves are updates
                router.replace(`/dashboard/workflows/editor?id=${data.workflow.id}`);
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Save error:', error);
            showNotification('Error saving workflow', 'error');
        }
    };

    const runWorkflow = async () => {
        try {
            setLoading(true);

            // Auto-save before running
            await saveWorkflow();

            const currentNodes = getNodes();
            const currentEdges = getEdges();

            // Validate we have minimum required nodes
            const promptNode = currentNodes.find(n => n.type === 'prompt');
            const svdNode = currentNodes.find(n => n.type === 'svdLoader');
            const hasOutput = currentNodes.some(n => n.type === 'output' || n.type === 'videoCombine');

            if (!promptNode && !svdNode) {
                setLoading(false);
                return showNotification("Please add a Prompt or SVD node!", "error");
            }
            if (!hasOutput) {
                setLoading(false);
                return showNotification("Please add an Output node!", "error");
            }

            // Submit Workflow Job
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'workflow',
                    workflow: {
                        nodes: currentNodes,
                        edges: currentEdges
                    },
                    prompt: promptNode?.data?.prompt || "Video Generation (SVD)"
                })
            });

            const data = await response.json();

            if (data.jobId) {
                setActiveJobId(data.jobId);
                // Clear previous execution state from all nodes
                setNodes((nds) => nds.map((n) => ({
                    ...n,
                    data: { ...n.data, executing: false, progress: undefined }
                })));
                showNotification(t("workflowQueued"));
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error("Unknown response from API");
            }

        } catch (error: any) {
            console.error(error);
            showNotification(t("executionError") + ": " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const onPaneClick = () => {
        if (searchOpen) setSearchOpen(false);
    };

    const onPaneContextMenu = (event: any) => {
        event.preventDefault();
        setClickPosition({ x: event.clientX - 260, y: event.clientY - 64 });
        setSearchOpen(true);
    };

    const allNodeTypes = [
        { type: 'loadModel', label: 'Load Checkpoint', color: '#818cf8' },
        { type: 'prompt', label: 'CLIP Text Encode', color: '#c084fc' },
        { type: 'loadImage', label: 'Load Image', color: '#fbbf24' },
        { type: 'controlNet', label: 'Apply ControlNet', color: '#34d399' },
        { type: 'sampler', label: 'KSampler', color: '#f87171' },
        { type: 'lora', label: 'Load LoRA', color: '#fbbf24' },
        { type: 'upscale', label: 'Image Upscale', color: '#38bdf8' },
        { type: 'output', label: 'Save Image', color: '#4ade80' },
        { type: 'emptyLatent', label: 'Empty Latent', color: '#ec4899' },
        { type: 'vaeEncode', label: 'VAE Encode', color: '#ef4444' },
        { type: 'vaeDecode', label: 'VAE Decode', color: '#ef4444' },
        { type: 'faceSwap', label: 'Face Swap', color: '#8b5cf6' },
        { type: 'inpaint', label: 'Inpaint', color: '#f59e0b' },
        { type: 'latentUpscale', label: 'Latent Upscale', color: '#ec4899' },
        { type: 'conditioningAverage', label: 'Conditioning Average', color: '#a855f7' },
        { type: 'svdLoader', label: 'SVD Loader', color: '#f43f5e' },
        { type: 'videoLinearCFG', label: 'Video Linear CFG', color: '#10b981' },
        { type: 'videoCombine', label: 'Video Combine', color: '#22c55e' },
        { type: 'groundingDinoLoader', label: 'GroundingDINO Loader', color: '#f43f5e' },
        { type: 'samModelLoader', label: 'SAM Model Loader', color: '#10b981' },
        { type: 'groundingDinoSAMSegment', label: 'Dino+SAM Auto Mask', color: '#f59e0b' },
        { type: 'maskRefine', label: 'Mask Refine', color: '#94a3b8' },
        { type: 'inpaintConditioning', label: 'SDXL Inpaint Cond', color: '#6366f1' },
    ];

    const filteredNodeTypes = allNodeTypes.filter(n =>
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="workflow-editor-container" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#09090b', position: 'relative' }}>

            {/* Floating Top Toolbar */}
            <div className="workflow-toolbar" style={{
                position: 'absolute',
                top: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                background: 'rgba(20, 20, 25, 0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                maxWidth: 'calc(100vw - 2rem)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => router.push('/dashboard/workflows')}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'transparent',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            border: 'none',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                        ←
                    </button>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                    <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            outline: 'none',
                            width: '200px'
                        }}
                    />
                </div>

                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={saveWorkflow}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            background: saved ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            color: saved ? '#4ade80' : 'white',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {saved ? (
                            <>
                                <div style={{ fontSize: '14px' }}>✓</div>
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save size={14} />
                                Save
                            </>
                        )}
                    </button>
                    <button
                        onClick={runWorkflow}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)'
                        }}
                    >
                        {loading ? <div className="animate-spin">⌛</div> : <Play size={14} fill="white" />}
                        Queue Prompt
                    </button>

                    {activeJobId && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(34, 197, 94, 0.15)',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            fontSize: '11px',
                            color: '#4ade80',
                            fontWeight: 500,
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#4ade80',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }} />
                            {executingNodeId ? `${t("runningNode")} ${executingNodeId}` : t("processing")}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', height: '100%', position: 'relative' }}>

                {/* Collapsible Node Library Panel */}
                <div className="node-panel" style={{
                    width: sidebarCollapsed ? '0px' : '280px',
                    height: '100%',
                    background: '#18181b',
                    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'visible',
                    zIndex: 20
                }}>
                    {/* Toggle Button */}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        style={{
                            position: 'absolute',
                            right: '-12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#27272a',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 30,
                            fontSize: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}
                    >
                        {sidebarCollapsed ? '❯' : '❮'}
                    </button>

                    {!sidebarCollapsed && (
                        <>
                            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Node Library
                                </h2>
                                <p style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>
                                    Drag or click to add nodes
                                </p>
                            </div>

                            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder={t("searchNodes")}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: '#27272a',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            borderRadius: '6px',
                                            padding: '8px 12px',
                                            paddingLeft: '32px',
                                            color: 'white',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: '14px' }}>
                                        🔍
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {allNodeTypes.filter(n =>
                                    n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    n.type.toLowerCase().includes(searchQuery.toLowerCase())
                                ).map((node) => (
                                    <button
                                        key={node.type}
                                        onClick={() => addNode(node.type)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            background: '#27272a',
                                            color: 'white',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#3f3f46';
                                            e.currentTarget.style.borderColor = node.color;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#27272a';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                        }}
                                    >
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '2px',
                                            background: node.color,
                                            boxShadow: `0 0 8px ${node.color}40`
                                        }} />
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{node.label}</div>
                                            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>{node.type}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ReactFlow Canvas Container */}
                <div style={{ flex: 1, height: '100%', position: 'relative' }}>

                    {/* Template Info / Guide Panel */}
                    {activeTemplate && showInfoPanel && (
                        <div style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            width: '320px',
                            maxHeight: 'calc(100% - 40px)',
                            overflowY: 'auto',
                            background: 'rgba(24, 24, 27, 0.95)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            zIndex: 15,
                            padding: '24px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                            animation: 'slideIn 0.3s ease-out'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: 0 }}>{activeTemplate.name}</h3>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                        <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
                                            {activeTemplate.category}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowInfoPanel(false)}
                                    style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
                                >
                                    ✕
                                </button>
                            </div>

                            <p style={{ color: '#d4d4d8', fontSize: '13px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                                {activeTemplate.description}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                        🎯 Summary
                                    </div>
                                    <div style={{ color: 'white', fontSize: '12px', lineHeight: '1.4' }}>{activeTemplate.guide.summary}</div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ color: '#34d399', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                        📥 Recommended Inputs
                                    </div>
                                    <div style={{ color: 'white', fontSize: '12px', lineHeight: '1.4' }}>{activeTemplate.guide.inputs}</div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                        ⚙️ Top Parameters
                                    </div>
                                    <div style={{ color: 'white', fontSize: '12px', lineHeight: '1.4' }}>{activeTemplate.guide.params}</div>
                                </div>

                                <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                                    <div style={{ color: '#f43f5e', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                        💡 Pro Tips
                                    </div>
                                    <div style={{ color: 'white', fontSize: '12px', fontStyle: 'italic', lineHeight: '1.4' }}>"{activeTemplate.guide.tips}"</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowInfoPanel(false)}
                                style={{
                                    width: '100%',
                                    marginTop: '20px',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    color: 'white',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                }}
                            >
                                Got it, let's build!
                            </button>
                        </div>
                    )}

                    {/* Show Guide Toggle (when hidden) */}
                    {activeTemplate && !showInfoPanel && (
                        <button
                            onClick={() => setShowInfoPanel(true)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(24, 24, 27, 0.8)',
                                color: 'white',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '10px',
                                padding: '8px 16px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                zIndex: 15,
                                backdropFilter: 'blur(12px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>💡</span>
                            Quick Guide
                        </button>
                    )}

                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onPaneClick={onPaneClick}
                        onPaneContextMenu={onPaneContextMenu}
                        snapToGrid={true}
                        snapGrid={[20, 20]}
                        fitView
                        style={{ background: '#09090b' }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color="#18181b" gap={20} size={1} />
                        <Controls
                            style={{
                                background: '#27272a',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                            }}
                        />

                        {/* Search Palette Overlay */}
                        {searchOpen && (
                            <div style={{
                                position: 'absolute',
                                left: clickPosition.x,
                                top: clickPosition.y,
                                width: '240px',
                                background: 'rgba(24, 24, 27, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                                zIndex: 1000,
                                padding: '8px',
                                animation: 'fadeIn 0.1s ease-out',
                                backdropFilter: 'blur(12px)'
                            }}>
                                <input
                                    autoFocus
                                    placeholder="Search nodes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: '#09090b',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '4px',
                                        padding: '8px',
                                        color: 'white',
                                        fontSize: '13px',
                                        marginBottom: '8px',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {[
                                        ...allNodeTypes
                                    ].filter(n =>
                                        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        n.type.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map(n => (
                                        <div
                                            key={n.type}
                                            onClick={() => addNode(n.type, { x: clickPosition.x, y: clickPosition.y })}
                                            style={{
                                                padding: '8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                fontSize: '12px',
                                                color: '#d1d5db',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ width: '8px', height: '8px', background: n.color, borderRadius: '2px' }} />
                                            {n.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <MiniMap
                            nodeColor={(n) => {
                                const colors: any = { loadModel: '#6366f1', prompt: '#a855f7', sampler: '#ef4444', output: '#22c55e' };
                                return colors[n.type || ''] || '#71717a';
                            }}
                            maskColor="rgba(9, 9, 11, 0.8)"
                            style={{ background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}
                        />
                    </ReactFlow>
                </div>
            </div>

            {/* Notification Toast */}
            {notification && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    zIndex: 100,
                    padding: '1rem 1.5rem',
                    background: notification.type === 'success' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 44, 44, 0.95)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px'
                    }}>
                        {notification.type === 'success' ? '✓' : '!'}
                    </div>
                    {notification.message}
                </div>
            )}

            <style jsx>{`
                @keyframes slideIn {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

        </div>
    );
}

export default function WorkflowEditor() {
    return (
        <ReactFlowProvider>
            <Suspense fallback={<div>Loading Editor...</div>}>
                <WorkflowEditorContent />
            </Suspense>
        </ReactFlowProvider>
    );
}
