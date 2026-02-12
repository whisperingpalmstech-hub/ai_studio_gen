"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
    Search,
    Filter,
    Box,
    Zap,
    Layers,
    Download,
    Upload,
    Info,
    Star,
    Shield,
    Tag,
    Clock,
    User,
    X,
    Plus,
    Check
} from "lucide-react";

interface Model {
    id: string;
    name: string;
    description: string | null;
    type: "checkpoint" | "lora" | "embedding" | "controlnet" | "vae" | "upscaler";
    base_model: string;
    thumbnail_url: string | null;
    trigger_words: string[] | null;
    is_public: boolean;
    is_system: boolean;
    download_count: number;
    created_at: string;
}

export default function ModelsPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newModel, setNewModel] = useState({
        name: "",
        type: "checkpoint",
        base_model: "sd15",
        file_path: "",
        description: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        const supabase = getSupabaseClient();

        // We can't use the /api/v1/models endpoint directly from client yet if it's on port 4000
        // and we don't have a proxy set up for it in next.config.js for this specific route.
        // But we can query Supabase directly from the client.

        const { data: { user } } = await supabase.auth.getUser();

        let query = (supabase
            .from("models") as any)
            .select("*")
            .order("created_at", { ascending: false });

        if (user) {
            query = query.or(`user_id.eq.${user.id},is_public.eq.true,is_system.eq.true`);
        } else {
            query = query.or(`is_public.eq.true,is_system.eq.true`);
        }

        const { data, error } = await query;

        if (data) {
            // De-duplicate by name, preferring system models
            const uniqueModels: Record<string, Model> = {};
            data.forEach((m: any) => {
                const existing = uniqueModels[m.name];
                if (!existing || (!existing.is_system && m.is_system)) {
                    uniqueModels[m.name] = m;
                }
            });
            setModels(Object.values(uniqueModels));
        }
        setLoading(false);
    };

    const filteredModels = models.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedType === "all" || m.type === selectedType;
        return matchesSearch && matchesType;
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'checkpoint': return '#6366f1';
            case 'lora': return '#f59e0b';
            case 'controlnet': return '#10b981';
            case 'embedding': return '#ec4899';
            default: return '#9ca3af';
        }
    };

    const handleAddModel = async () => {
        setIsSubmitting(true);
        try {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("Authentication required");

            const { error } = await (supabase.from("models") as any).insert({
                name: newModel.name,
                type: newModel.type,
                base_model: newModel.base_model,
                file_path: newModel.file_path,
                description: newModel.description,
                user_id: user.id,
                is_public: false,
                is_system: false
            });

            if (error) throw error;

            setIsAddModalOpen(false);
            setNewModel({ name: "", type: "checkpoint", base_model: "sd15", file_path: "", description: "" });
            fetchModels();
            alert("Model added successfully!");
        } catch (err: any) {
            console.error("Error adding model:", err);
            alert("Failed to add model: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: '100rem', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                        Model Library
                    </h1>
                    <p style={{ color: '#9ca3af' }}>
                        Browse and manage generative AI models, LoRAs, and embeddings.
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        color: 'white',
                        border: 'none',
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                    }}
                >
                    <Plus size={18} />
                    Add Model
                </button>
            </div>

            {/* Filter Bar */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(8px)'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 3rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(15, 15, 35, 0.6)',
                            color: 'white',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(15, 15, 35, 0.6)',
                        color: 'white',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer'
                    }}
                >
                    <option value="all">All Types</option>
                    <option value="checkpoint">Checkpoints</option>
                    <option value="lora">LoRAs</option>
                    <option value="controlnet">ControlNet</option>
                    <option value="embedding">Embeddings</option>
                    <option value="vae">VAE</option>
                </select>
            </div>

            {/* Models Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
                    <div className="animate-spin" style={{ marginBottom: '1rem' }}>⌛</div>
                    Loading model library...
                </div>
            ) : filteredModels.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '6rem 2rem',
                    borderRadius: '0.75rem',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)'
                }}>
                    <Box style={{ width: '4rem', height: '4rem', margin: '0 auto 1.5rem', color: '#6366f1', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', color: 'white' }}>
                        No models found
                    </h3>
                    <p style={{ color: '#9ca3af', marginBottom: '2rem', maxWidth: '30rem', margin: '0 auto 2rem' }}>
                        We couldn't find any models matching your criteria. Try adjusting your search or filters.
                    </p>
                    <button
                        onClick={() => { setSearchQuery(""); setSelectedType("all"); }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'transparent',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Clear All Filters
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {filteredModels.map((model) => (
                        <div
                            key={model.id}
                            style={{
                                borderRadius: '1rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = getTypeColor(model.type);
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.boxShadow = `0 12px 24px -12px ${getTypeColor(model.type)}40`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Thumbnail */}
                            <div style={{ position: 'relative', height: '180px', backgroundColor: '#0f0f1b', overflow: 'hidden' }}>
                                {model.thumbnail_url ? (
                                    <img
                                        src={model.thumbnail_url}
                                        alt={model.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                        <Box size={64} />
                                    </div>
                                )}

                                {/* Badges */}
                                <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                    <div style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        backdropFilter: 'blur(4px)',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {model.base_model}
                                    </div>
                                    {model.is_system && (
                                        <div style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: 'rgba(99, 102, 241, 0.8)',
                                            color: 'white',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Shield size={10} />
                                            SYSTEM
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    position: 'absolute',
                                    bottom: '0.75rem',
                                    right: '0.75rem',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: getTypeColor(model.type),
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    {model.type}
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>
                                    {model.name}
                                </h3>
                                <p style={{
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    marginBottom: '1.25rem',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    height: '2.5rem'
                                }}>
                                    {model.description || "No description provided."}
                                </p>

                                {model.trigger_words && model.trigger_words.length > 0 && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {model.trigger_words.slice(0, 3).map((word, i) => (
                                                <span key={i} style={{
                                                    fontSize: '10px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    color: '#d1d5db'
                                                }}>
                                                    {word}
                                                </span>
                                            ))}
                                            {model.trigger_words.length > 3 && (
                                                <span style={{ fontSize: '10px', color: '#6b7280' }}>+{model.trigger_words.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
                                            <Download size={14} />
                                            {model.download_count}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
                                            <Clock size={14} />
                                            {new Date(model.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Model Modal */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#11111e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '1rem',
                        width: '100%',
                        maxWidth: '500px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>Register New Model</h2>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>Model Name</label>
                                <input
                                    type="text"
                                    value={newModel.name}
                                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                                    placeholder="e.g. My Custom LoRA"
                                    style={modalInputStyle}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>Type</label>
                                    <select
                                        value={newModel.type}
                                        onChange={(e) => setNewModel({ ...newModel, type: e.target.value as any })}
                                        style={modalInputStyle}
                                    >
                                        <option value="checkpoint">Checkpoint</option>
                                        <option value="lora">LoRA</option>
                                        <option value="controlnet">ControlNet</option>
                                        <option value="vae">VAE</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>Base Model</label>
                                    <select
                                        value={newModel.base_model}
                                        onChange={(e) => setNewModel({ ...newModel, base_model: e.target.value })}
                                        style={modalInputStyle}
                                    >
                                        <option value="sd15">SD 1.5</option>
                                        <option value="sdxl">SDXL</option>
                                        <option value="flux">Flux</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>File Name / Path</label>
                                <input
                                    type="text"
                                    value={newModel.file_path}
                                    onChange={(e) => setNewModel({ ...newModel, file_path: e.target.value })}
                                    placeholder="e.g. style_v1.safetensors"
                                    style={modalInputStyle}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.375rem' }}>Must exist in ComfyUI models folder.</p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>Description</label>
                                <textarea
                                    value={newModel.description}
                                    onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                                    placeholder="Brief details about this model..."
                                    style={{ ...modalInputStyle, height: '80px', resize: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'transparent',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddModel}
                                disabled={isSubmitting || !newModel.name || !newModel.file_path}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: (isSubmitting || !newModel.name || !newModel.file_path) ? 'not-allowed' : 'pointer',
                                    opacity: (isSubmitting || !newModel.name || !newModel.file_path) ? 0.7 : 1
                                }}
                            >
                                {isSubmitting ? "Creating..." : "Save Model"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const modalInputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '0.875rem',
    outline: 'none'
};
