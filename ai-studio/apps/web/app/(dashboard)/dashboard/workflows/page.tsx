"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { enterpriseToast } from "@/components/ui/enterprise-toast";
import { styledConfirm } from "@/components/ui/confirm-modal";
import { Plus, Play, Trash2, Edit, Loader2, Calendar, Link as LinkIcon, Zap, Layout, Brush, History, Layers } from "lucide-react";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";
import { useI18n } from "@/lib/i18n";

interface Workflow {
    id: string;
    name: string;
    description: string;
    nodes: any[];
    updated_at: string;
}

const CATEGORY_ICONS: Record<string, any> = {
    'Essentials': Zap,
    'Transformation': Layout,
    'Repair': Brush,
    'Advanced': Layers
};

export default function WorkflowsPage() {
    const { t } = useI18n();
    const router = useRouter();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const response = await fetch('/api/workflows');
            const data = await response.json();
            if (data.workflows) {
                setWorkflows(data.workflows);
            }
        } catch (error) {
            console.error("Failed to fetch workflows:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await styledConfirm({ title: "Delete Workflow?", message: "Are you sure you want to delete this workflow? This action cannot be undone.", confirmLabel: "Delete", variant: "danger" });
        if (!ok) return;

        setDeletingId(id);
        try {
            const response = await fetch(`/api/workflows/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setWorkflows((prev) => prev.filter((w) => w.id !== id));
            } else {
                enterpriseToast.error("Delete Failed", "Failed to delete workflow");
            }
        } catch (error) {
            console.error("Delete error:", error);
            enterpriseToast.error("Error", "An error occurred while deleting");
        } finally {
            setDeletingId(null);
        }
    };

    const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);

    const handleUseTemplate = async (template: any) => {
        setCreatingTemplate(template.id);
        try {
            const response = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: template.name,
                    description: template.description,
                    nodes: template.nodes,
                    edges: template.edges
                })
            });

            if (response.ok) {
                const data = await response.json();
                router.push(`/dashboard/workflows/editor?id=${data.workflow.id}`);
            } else {
                enterpriseToast.error("Template Error", "Failed to create workflow from template");
            }
        } catch (error) {
            console.error("Template error:", error);
            enterpriseToast.error("Error", "An error occurred");
        } finally {
            setCreatingTemplate(null);
        }
    };

    const handleEdit = (id: string) => {
        router.push(`/dashboard/workflows/editor?id=${id}`);
    };

    const handleCreate = () => {
        router.push('/dashboard/workflows/editor');
    };

    return (
        <div style={{ maxWidth: '100rem', margin: '0 auto', minHeight: '80vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>\n                        {t('workflowTitle')}\n                    </h1>
                    <p style={{ color: '#9ca3af' }}>
                        {t('workflowDesc')}
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'transform 0.2s',
                        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4), 0 2px 4px -1px rgba(99, 102, 241, 0.2)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Plus style={{ width: '1.25rem', height: '1.25rem' }} />\n                    <Plus style={{ width: '1.25rem', height: '1.25rem' }} />\n                    {t('newWorkflow')}\n                </button>
            </div>

            {/* Quick Start Templates */}
            <div style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                    <Zap size={20} style={{ color: '#f59e0b' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{t('quickStartTemplates')}</h2>
                </div>
                <div className="workflow-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {WORKFLOW_TEMPLATES.map((template) => {
                        const Icon = CATEGORY_ICONS[template.category] || Zap;
                        return (
                            <div
                                key={template.id}
                                style={{
                                    padding: '1.5rem',
                                    borderRadius: '1rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.3s ease',
                                    cursor: 'default',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = '#6366f1';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#818cf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1rem'
                                }}>
                                    <Icon size={20} />
                                </div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>{template.name}</h3>
                                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', lineHeight: '1.5', marginBottom: '1.5rem', flex: 1 }}>{template.description}</p>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        color: '#6366f1',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        {template.category}
                                    </span>
                                    <button
                                        onClick={() => handleUseTemplate(template)}
                                        disabled={creatingTemplate === template.id}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#818cf8',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {creatingTemplate === template.id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>\n                                                {t('useTemplate')}
                                                <span style={{ fontSize: '14px' }}>→</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                <History size={20} style={{ color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{t('myWorkflows')}</h2>
            </div>

            {/* Loading State */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <Loader2 style={{ width: '2rem', height: '2rem', color: '#6366f1', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : (
                <div className="workflow-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>

                    {/* Create New Card */}
                    <div
                        onClick={handleCreate}
                        style={{
                            borderRadius: '0.75rem',
                            border: '2px dashed rgba(255, 255, 255, 0.2)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3rem',
                            minHeight: '280px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#6366f1';
                            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                        }}
                    >
                        <div style={{
                            width: '4rem',
                            height: '4rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem',
                            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                        }}>
                            <Plus style={{ width: '2rem', height: '2rem', color: 'white' }} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>\n                            {t('createWorkflow')}\n                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center' }}>
                            {t('createWorkflowStartFromScratch')}
                        </p>
                    </div>

                    {/* Workflow Cards */}
                    {workflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            style={{
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#6366f1';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Workflow Header / Thumbnail Area */}
                            <div style={{
                                height: '140px',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                position: 'relative'
                            }}>
                                <LinkIcon style={{ width: '3rem', height: '3rem', color: 'rgba(255, 255, 255, 0.5)' }} />

                                <div style={{
                                    position: 'absolute',
                                    bottom: '0.75rem',
                                    right: '0.75rem',
                                    background: 'rgba(0, 0, 0, 0.6)',
                                    backdropFilter: 'blur(4px)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                                    {Array.isArray(workflow.nodes) ? workflow.nodes.length : 0} {t('nodesLabel')}
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ marginBottom: 'auto' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {workflow.name}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {workflow.description || "No description provided."}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
                                    <Calendar style={{ width: '0.875rem', height: '0.875rem' }} />
                                    {t('updatedDateLabel')} {new Date(workflow.updated_at).toLocaleDateString()}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                    <button
                                        onClick={() => handleEdit(workflow.id)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            padding: '0.625rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: '#6366f1',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                                    >
                                        <Edit style={{ width: '1rem', height: '1rem' }} />\n                                        <Edit style={{ width: '1rem', height: '1rem' }} />\n                                        {t('editLabel')}\n                                    </button>

                                    <button
                                        onClick={() => handleCreate()} // Placeholder for "Run" directly from card, implies open editor then run
                                        style={{
                                            padding: '0.625rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        title="Run Workflow"
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                    >
                                        <Play style={{ width: '1rem', height: '1rem' }} />
                                    </button>

                                    <button
                                        onClick={() => handleDelete(workflow.id)}
                                        disabled={deletingId === workflow.id}
                                        style={{
                                            padding: '0.625rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            cursor: deletingId === workflow.id ? 'not-allowed' : 'pointer',
                                            transition: 'background 0.2s',
                                            opacity: deletingId === workflow.id ? 0.5 : 1
                                        }}
                                        title="Delete Workflow"
                                        onMouseEnter={(e) => !deletingId && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                                        onMouseLeave={(e) => !deletingId && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                                    >
                                        {deletingId === workflow.id ? (
                                            <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <Trash2 style={{ width: '1rem', height: '1rem' }} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
