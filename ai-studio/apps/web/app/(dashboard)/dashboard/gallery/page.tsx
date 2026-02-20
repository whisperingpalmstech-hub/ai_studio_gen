"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Download, Trash2, Calendar, Sparkles, Search, Filter, Loader2, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface Generation {
    id: string;
    prompt: string | null;
    negative_prompt: string | null;
    file_path: string;
    width: number | null;
    height: number | null;
    params: any;
    seed: number | null;
    created_at: string;
    type: string;
}

export default function GalleryPage() {
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedImage, setSelectedImage] = useState<Generation | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const { toast } = useToast();
    const { t } = useI18n();

    useEffect(() => {
        fetchGenerations();
    }, []);

    const fetchGenerations = async () => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data, error } = await supabase
                .from("assets")
                .select("*")
                .eq("user_id", user.id)
                .in("type", ["image", "video"])
                .order("created_at", { ascending: false });

            if (data) {
                setGenerations(data);
            }
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        // Optimistic Update: Store previous state for rollback
        const previousGenerations = [...generations];
        setConfirmDeleteId(null);
        setDeletingId(id);

        try {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                toast({
                    title: "Authentication required",
                    description: "Please log in to manage your gallery.",
                    variant: "destructive",
                });
                return;
            }

            // Enterprise Grade API Call - Internal Next.js API Proxy
            const response = await fetch(`/api/generations/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to remove generation from server.");
            }

            // Successfully deleted
            setGenerations(prev => prev.filter(g => g.id !== id));
            if (selectedImage?.id === id) setSelectedImage(null);

            toast({
                title: "Generation deleted",
                description: "Your creation and its data have been permanently removed.",
            });

        } catch (error: any) {
            console.error("Critical Delete Error:", error);
            // Rollback optimistic update
            setGenerations(previousGenerations);
            toast({
                title: "Delete failed",
                description: error.message || "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownload = (imageUrl: string, id: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `generation-${id}.png`;
        link.click();
    };

    const filteredGenerations = generations.filter(gen =>
        (gen.prompt || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ maxWidth: '100rem', margin: '0 auto', padding: '0 1rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>\n                    {t('galleryTitle')}\n                </h1>
                <p style={{ color: '#9ca3af' }}>
                    {t('manageImages')}
                </p>
            </div>

            {/* Search & Filter Bar */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="{t('searchPrompt')}"
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
                <button style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'transparent',
                    color: 'white',
                    cursor: 'pointer'
                }}>
                    <Filter style={{ width: '1rem', height: '1rem' }} />\n                    <Filter style={{ width: '1rem', height: '1rem' }} />\n                    {t('filter')}\n                </button>
            </div>

            {/* Gallery Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
                    Loading your creations...
                </div>
            ) : filteredGenerations.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                }}>
                    <Sparkles style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', color: '#6366f1', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>\n                        {t('noGensYet')}\n                    </h3>
                    <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                        {t('startCreatingImages')}
                    </p>
                    <a href="/dashboard/generate" style={{
                        display: 'inline-block',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        color: 'white',
                        textDecoration: 'none',
                        fontWeight: 500
                    }}>\n                        {t('genFirstImage')}\n                    </a>
                </div>
            ) : (
                <div className="recent-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {filteredGenerations.map((gen) => (
                        <div
                            key={gen.id}
                            onClick={() => setSelectedImage(gen)}
                            style={{
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#6366f1';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                                if (btn) btn.style.opacity = '0';
                            }}
                        >
                            <div style={{ position: 'relative', paddingTop: '100%', backgroundColor: '#1a1a2e' }}>
                                {gen.type === 'video' ? (
                                    <video
                                        src={gen.file_path}
                                        autoPlay
                                        loop
                                        muted
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={gen.file_path}
                                        alt={gen.prompt || "Generated image"}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                )}
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(gen.id);
                                    }}
                                    disabled={deletingId === gen.id}
                                    style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        color: '#ef4444',
                                        border: 'none',
                                        cursor: deletingId === gen.id ? 'not-allowed' : 'pointer',
                                        opacity: deletingId === gen.id ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    className="delete-btn"
                                >
                                    {deletingId === gen.id ? (
                                        <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" />
                                    ) : (
                                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                                    )}
                                </button>
                                <p style={{
                                    fontSize: '0.875rem',
                                    color: 'white',
                                    marginBottom: '0.5rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {gen.prompt || t('noPromptAvail')}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                                    <Calendar style={{ width: '0.875rem', height: '0.875rem' }} />
                                    {new Date(gen.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Detail Modal */}
            {selectedImage && (
                <div
                    onClick={() => setSelectedImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="image-lightbox-content"
                        style={{
                            maxWidth: '90rem',
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))',
                            gap: '2rem',
                            backgroundColor: 'hsl(222, 47%, 6%)',
                            borderRadius: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedImage(null)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                zIndex: 10,
                                width: '2.5rem',
                                height: '2.5rem',
                                borderRadius: '50%',
                                background: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.6)';
                                e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                            }}
                        >
                            <X style={{ width: '1.25rem', height: '1.25rem' }} />
                        </button>
                        {/* Media Display */}
                        <div style={{ padding: '2rem' }}>
                            {selectedImage.type === 'video' ? (
                                <video
                                    src={selectedImage.file_path}
                                    controls
                                    autoPlay
                                    loop
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                            ) : (
                                <img
                                    src={selectedImage.file_path}
                                    alt={selectedImage.prompt || "Generated image"}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                            )}
                        </div>

                        {/* Details */}
                        <div style={{ padding: '2rem', overflow: 'auto' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'white' }}>\n                                {t('genDetails')}\n                            </h2>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>\n                                    {t('promptLabel')}\n                                </label>
                                <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                    {selectedImage.prompt || t('noPromptAvail')}
                                </p>
                            </div>

                            {selectedImage.negative_prompt && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>\n                                        {t('negPromptLabel')}\n                                    </label>
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                        {selectedImage.negative_prompt}
                                    </p>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('sizeLabel')}</label>
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                        {selectedImage.width} × {selectedImage.height}
                                    </p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('stepsLabel')}</label>
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                        {selectedImage.params?.steps || selectedImage.params?.num_inference_steps || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('cfgScaleLabel')}</label>
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                        {selectedImage.params?.guidance_scale || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('seedLabel')}</label>
                                    <p style={{ color: 'white', fontSize: '0.875rem' }}>
                                        {selectedImage.seed}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => handleDownload(selectedImage.file_path, selectedImage.id)}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem',
                                        borderRadius: '0.5rem',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    <Download style={{ width: '1rem', height: '1rem' }} />\n                                    <Download style={{ width: '1rem', height: '1rem' }} />\n                                    {t('downloadLabel')}\n                                </button>
                                <button
                                    onClick={() => setConfirmDeleteId(selectedImage.id)}
                                    disabled={deletingId === selectedImage.id}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        backgroundColor: deletingId === selectedImage.id ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        cursor: deletingId === selectedImage.id ? 'not-allowed' : 'pointer',
                                        fontWeight: 500,
                                        opacity: deletingId === selectedImage.id ? 0.7 : 1
                                    }}
                                >
                                    {deletingId === selectedImage.id ? (
                                        <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" />
                                    ) : (
                                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                                    )}
                                    {deletingId === selectedImage.id ? "Deleting..." : t('deleteLabel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
            {/* Confirmation Modal */}
            {confirmDeleteId && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        maxWidth: '28rem',
                        width: '100%',
                        backgroundColor: '#1a1a2e',
                        borderRadius: '1rem',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '2rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#ef4444' }}>
                                <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>{t('confirmDelTitle')}</h3>
                            </div>
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ color: '#9ca3af', marginBottom: '2rem', lineHeight: 1.6 }}>
                            {t('confirmDelMsg')}
                        </p>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    backgroundColor: 'transparent',
                                    color: 'white',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >\n                                {t('cancel')}\n                            </button>
                            <button
                                onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >\n                                {t('delPermanently')}\n                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
