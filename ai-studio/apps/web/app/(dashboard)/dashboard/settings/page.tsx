"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { User, CreditCard, Key, Bell, Shield, LogOut, Sparkles, Copy, Trash2, Plus, Eye, EyeOff, AlertTriangle, Check, Clock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { enterpriseToast } from "@/components/ui/enterprise-toast";
import { styledConfirm } from "@/components/ui/confirm-modal";

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    is_active: boolean;
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export default function SettingsPage() {
    const { t } = useI18n();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"profile" | "billing" | "api" | "notifications" | "security">("profile");
    const [profile, setProfile] = useState({ email: "", name: "", credits: 100, tier: "free" });
    const [loading, setLoading] = useState(true);

    // API Key state
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [creatingKey, setCreatingKey] = useState(false);
    const [revealedKey, setRevealedKey] = useState<string | null>(null); // The newly generated key (shown once)
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeTab === "api") {
            fetchApiKeys();
        }
    }, [activeTab]);

    const fetchProfile = async () => {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data: profileData } = await (supabase
                .from("profiles") as any)
                .select("credits, tier")
                .eq("id", user.id)
                .single();

            setProfile({
                email: user.email || "",
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || "",
                credits: (profileData as any)?.credits || 100,
                tier: (profileData as any)?.tier || "free",
            });
        }
        setLoading(false);
    };

    const fetchApiKeys = async () => {
        setLoadingKeys(true);
        try {
            const res = await fetch("/api/user/api-keys");
            const data = await res.json();
            if (data.keys) setApiKeys(data.keys);
        } catch (err) {
            console.error("Failed to load API keys:", err);
        } finally {
            setLoadingKeys(false);
        }
    };

    const handleCreateKey = async () => {
        setCreatingKey(true);
        try {
            const res = await fetch("/api/user/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKeyName || "Default" }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to create key");

            setRevealedKey(data.key);
            setNewKeyName("");
            fetchApiKeys();
            enterpriseToast.success("API Key Created", "Your new key has been generated. Copy it now — it won't be shown again.");
        } catch (err: any) {
            enterpriseToast.error("Failed to Create Key", err.message);
        } finally {
            setCreatingKey(false);
        }
    };

    const handleDeleteKey = async (keyId: string, keyName: string) => {
        const ok = await styledConfirm({
            title: "Revoke API Key?",
            message: `This will permanently revoke "${keyName}". Any integrations using this key will stop working.`,
            confirmLabel: "Revoke Key",
            variant: "danger",
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/user/api-keys?id=${keyId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete key");
            setApiKeys(prev => prev.filter(k => k.id !== keyId));
            enterpriseToast.success("Key Revoked", `API key "${keyName}" has been revoked`);
        } catch (err: any) {
            enterpriseToast.error("Delete Failed", err.message);
        }
    };

    const handleCopyKey = async (key: string) => {
        try {
            await navigator.clipboard.writeText(key);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
            enterpriseToast.success("Copied!", "API key copied to clipboard");
        } catch {
            enterpriseToast.error("Copy Failed", "Could not copy to clipboard");
        }
    };

    const handleSignOut = async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
        router.push("/login");
    };

    const tabs = [
        { id: "profile" as const, label: t("profileTab"), icon: User },
        { id: "billing" as const, label: t("billingTab"), icon: CreditCard },
        { id: "api" as const, label: t("apiKeysTab"), icon: Key },
        { id: "notifications" as const, label: t("notificationsTab"), icon: Bell },
        { id: "security" as const, label: t("securityTab"), icon: Shield },
    ];

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 15, 35, 0.6)',
        color: 'white',
        fontSize: '0.875rem',
        outline: 'none',
    };

    return (
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>
                    Settings
                </h1>
                <p style={{ color: '#9ca3af' }}>
                    {t("settingsDesc")}
                </p>
            </div>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
                {/* Sidebar */}
                <div className="settings-sidebar" style={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    padding: '1rem',
                    height: 'fit-content'
                }}>
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.875rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    backgroundColor: activeTab === tab.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: activeTab === tab.id ? '#6366f1' : '#9ca3af',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    marginBottom: '0.5rem',
                                    fontWeight: activeTab === tab.id ? 600 : 400,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Icon style={{ width: '1.25rem', height: '1.25rem' }} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div>
                    {/* ─────── PROFILE TAB ─────── */}
                    {activeTab === "profile" && (
                        <div style={{
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            padding: '2rem'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white' }}>
                                Profile Information
                            </h2>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'white' }}>{t("nameLabel")}</label>
                                <input
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'white' }}>{t("emailLabel")}</label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    style={{ ...inputStyle, backgroundColor: 'rgba(15, 15, 35, 0.3)', color: '#9ca3af', cursor: 'not-allowed' }}
                                />
                            </div>

                            <button style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}>
                                Save Changes
                            </button>
                        </div>
                    )}

                    {/* ─────── BILLING TAB ─────── */}
                    {activeTab === "billing" && (
                        <div>
                            {/* Credits Card */}
                            <div style={{
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                                padding: '2rem',
                                marginBottom: '2rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        width: '3rem', height: '3rem', borderRadius: '0.75rem',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Zap style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.25rem' }}>{t("availableCredits")}</div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>{profile.credits}</div>
                                    </div>
                                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '1rem',
                                            background: profile.tier === 'pro' ? 'rgba(99, 102, 241, 0.15)' : profile.tier === 'enterprise' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            color: profile.tier === 'pro' ? '#818cf8' : profile.tier === 'enterprise' ? '#fbbf24' : '#9ca3af',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}>
                                            {profile.tier} plan
                                        </div>
                                    </div>
                                </div>

                                {/* Credit bar */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                                        <span>{t("usage")}</span>
                                        <span>{profile.credits} / {profile.tier === 'pro' ? '1,000' : profile.tier === 'enterprise' ? '5,000' : '100'}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${Math.min((profile.credits / (profile.tier === 'pro' ? 1000 : profile.tier === 'enterprise' ? 5000 : 100)) * 100, 100)}%`,
                                            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                            borderRadius: '3px',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Credit Costs Table */}
                                <div style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '0.5rem',
                                    padding: '1rem',
                                    marginTop: '1rem',
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Credit Costs
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        {[
                                            { label: "Text to Image", cost: 1 },
                                            { label: "Image to Image", cost: 1 },
                                            { label: "Inpainting", cost: 2 },
                                            { label: "Upscale", cost: 1 },
                                            { label: "Text to Video", cost: 5 },
                                            { label: "Image to Video", cost: 5 },
                                        ].map(item => (
                                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
                                                <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>{item.label}</span>
                                                <span style={{
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    color: '#818cf8',
                                                    background: 'rgba(99,102,241,0.1)',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '0.25rem',
                                                }}>
                                                    {item.cost} cr
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Subscription Plans */}
                            <div style={{
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                padding: '2rem'
                            }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white' }}>
                                    Subscription Plans
                                </h2>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                                    {[
                                        { name: "Free", price: "$0/mo", credits: "100 credits/mo", features: ["Basic models", "Standard support", "Community access"], current: profile.tier === "free" },
                                        { name: "Pro", price: "$29/mo", credits: "1,000 credits/mo", features: ["All models", "Priority support", "API access", "Custom LoRAs"], current: profile.tier === "pro" },
                                        { name: "Enterprise", price: "$99/mo", credits: "5,000 credits/mo", features: ["Custom models", "24/7 support", "Team workspace", "Dedicated GPU"], current: profile.tier === "enterprise" }
                                    ].map((plan) => (
                                        <div
                                            key={plan.name}
                                            style={{
                                                padding: '1.5rem',
                                                borderRadius: '0.75rem',
                                                border: plan.current ? '2px solid #6366f1' : plan.name === "Pro" && !plan.current ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                backgroundColor: plan.current ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                                position: 'relative',
                                            }}
                                        >
                                            {plan.current && (
                                                <div style={{
                                                    position: 'absolute', top: '-0.75rem', right: '1rem',
                                                    padding: '0.25rem 0.75rem', borderRadius: '1rem',
                                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                                    fontSize: '0.6875rem', fontWeight: 700, color: 'white',
                                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                                }}>
                                                    Current
                                                </div>
                                            )}
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>{plan.name}</h3>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '0.5rem' }}>{plan.price}</div>
                                            <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>{plan.credits}</div>
                                            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                                                {plan.features.map((feature, idx) => (
                                                    <li key={idx} style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Check size={14} style={{ color: '#10b981' }} />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                            <button style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                border: 'none',
                                                background: plan.current ? 'rgba(255, 255, 255, 0.05)' : plan.name === "Pro" ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                                                color: plan.current ? '#9ca3af' : 'white',
                                                cursor: plan.current ? 'default' : 'pointer',
                                                fontWeight: 600
                                            }}>
                                                {plan.current ? "Current Plan" : "Upgrade"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─────── API KEYS TAB ─────── */}
                    {activeTab === "api" && (
                        <div>
                            {/* Header */}
                            <div style={{
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                padding: '2rem',
                                marginBottom: '1.5rem',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                                            API Keys
                                        </h2>
                                        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                                            Generate API keys to access AI Studio programmatically. Keys are shown once — save them securely.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setShowNewKeyModal(true); setRevealedKey(null); }}
                                        disabled={apiKeys.length >= 5}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.75rem 1.25rem', borderRadius: '0.5rem',
                                            border: 'none',
                                            background: apiKeys.length >= 5 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: apiKeys.length >= 5 ? '#6b7280' : 'white',
                                            cursor: apiKeys.length >= 5 ? 'not-allowed' : 'pointer',
                                            fontWeight: 600, fontSize: '0.875rem',
                                            boxShadow: apiKeys.length >= 5 ? 'none' : '0 4px 12px rgba(99,102,241,0.25)',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Plus size={16} />
                                        Generate Key
                                    </button>
                                </div>

                                {/* Usage info */}
                                <div style={{
                                    display: 'flex', gap: '2rem',
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                    background: 'rgba(99, 102, 241, 0.05)',
                                    border: '1px solid rgba(99, 102, 241, 0.1)',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{t("keysUsed")}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{apiKeys.length} / 5</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Base URL</div>
                                        <code style={{ fontSize: '0.8125rem', color: '#818cf8', fontFamily: 'monospace' }}>
                                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* Key List */}
                            {loadingKeys ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading keys...</div>
                            ) : apiKeys.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '4rem 2rem',
                                    borderRadius: '0.75rem',
                                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                }}>
                                    <Key style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', color: '#6366f1', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>
                                        No API Keys Yet
                                    </h3>
                                    <p style={{ color: '#9ca3af', marginBottom: '1.5rem', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
                                        Generate your first API key to start using the AI Studio API in your applications.
                                    </p>
                                    <button
                                        onClick={() => { setShowNewKeyModal(true); setRevealedKey(null); }}
                                        style={{
                                            padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none',
                                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: 'white', cursor: 'pointer', fontWeight: 600,
                                            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                                        }}
                                    >
                                        Generate Your First Key
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {apiKeys.map((key) => (
                                        <div
                                            key={key.id}
                                            className="api-key-item"
                                            style={{
                                                borderRadius: '0.75rem',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                                padding: '1.25rem 1.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {/* Key icon */}
                                            <div style={{
                                                width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem',
                                                background: key.is_active ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                <Key size={16} style={{ color: key.is_active ? '#818cf8' : '#ef4444' }} />
                                            </div>

                                            {/* Key info */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontWeight: 600, color: 'white', fontSize: '0.875rem' }}>{key.name}</span>
                                                    <span style={{
                                                        padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                                                        fontSize: '0.625rem', fontWeight: 700,
                                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        color: key.is_active ? '#10b981' : '#ef4444',
                                                        background: key.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                    }}>
                                                        {key.is_active ? "Active" : "Revoked"}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                                    <code style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{key.key_prefix}••••••••••</code>
                                                    <span>•</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Clock size={12} />
                                                        Created {new Date(key.created_at).toLocaleDateString()}
                                                    </span>
                                                    {key.last_used_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="api-key-actions">
                                                <button
                                                    onClick={() => handleDeleteKey(key.id, key.name)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem',
                                                        border: '1px solid rgba(239,68,68,0.2)', background: 'transparent',
                                                        color: '#ef4444', cursor: 'pointer', flexShrink: 0,
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                    title="Revoke key"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Quick API reference */}
                            <div style={{
                                marginTop: '2rem',
                                borderRadius: '0.75rem',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                padding: '1.5rem',
                            }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>{t("quickStart")}</h3>
                                <div style={{
                                    background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', padding: '1rem',
                                    fontFamily: 'monospace', fontSize: '0.8125rem', color: '#d1d5db',
                                    overflowX: 'auto', lineHeight: 1.6,
                                }}>
                                    <div style={{ color: '#6b7280' }}># Generate an image with your API key</div>
                                    <div>curl -X POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/generate \</div>
                                    <div>&nbsp;&nbsp;-H <span style={{ color: '#a78bfa' }}>"x-api-key: YOUR_API_KEY"</span> \</div>
                                    <div>&nbsp;&nbsp;-H <span style={{ color: '#a78bfa' }}>"Content-Type: application/json"</span> \</div>
                                    <div>&nbsp;&nbsp;-d <span style={{ color: '#a78bfa' }}>'{`{"prompt": "a beautiful sunset", "type": "txt2img"}`}'</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─────── NOTIFICATIONS TAB ─────── */}
                    {activeTab === "notifications" && (
                        <div style={{
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            padding: '2rem'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white' }}>
                                Notification Preferences
                            </h2>

                            {[
                                { label: "Email notifications for completed generations", checked: true },
                                { label: "Weekly usage reports", checked: false },
                                { label: "New feature announcements", checked: true },
                                { label: "Billing and payment updates", checked: true },
                            ].map((pref, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1rem 0',
                                        borderBottom: idx < 3 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                                    }}
                                >
                                    <span style={{ color: 'white', fontSize: '0.875rem' }}>{pref.label}</span>
                                    <input type="checkbox" defaultChecked={pref.checked} style={{ width: '1.25rem', height: '1.25rem', accentColor: '#6366f1', cursor: 'pointer' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ─────── SECURITY TAB ─────── */}
                    {activeTab === "security" && (
                        <div style={{
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            padding: '2rem'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white' }}>
                                Security Settings
                            </h2>

                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'white' }}>{t("changePassword")}</h3>
                                <button style={{
                                    padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white', cursor: 'pointer', fontWeight: 500
                                }}>
                                    Update Password
                                </button>
                            </div>

                            <div style={{
                                padding: '1.5rem', borderRadius: '0.75rem',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backgroundColor: 'rgba(239, 68, 68, 0.05)'
                            }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>{t("dangerZone")}</h3>
                                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                    Once you delete your account, all data will be permanently removed.
                                </p>
                                <button
                                    onClick={handleSignOut}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
                                        border: '1px solid rgba(239, 68, 68, 0.5)',
                                        backgroundColor: 'transparent', color: '#ef4444',
                                        cursor: 'pointer', fontWeight: 500, marginBottom: '0.5rem'
                                    }}
                                >
                                    <LogOut style={{ width: '1rem', height: '1rem' }} />
                                    Sign Out
                                </button>
                                <button style={{
                                    padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444', cursor: 'pointer', fontWeight: 500
                                }}>
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─────── CREATE KEY MODAL ─────── */}
            {showNewKeyModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
                    }}
                    onClick={() => { if (!revealedKey) setShowNewKeyModal(false); }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: '520px', margin: '1rem',
                            borderRadius: '1rem',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            backgroundColor: '#0f0f1e',
                            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
                            overflow: 'hidden',
                        }}
                    >
                        {!revealedKey ? (
                            // Step 1: Name your key
                            <>
                                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Key size={20} style={{ color: '#818cf8' }} />
                                        Generate API Key
                                    </h2>
                                </div>

                                <div style={{ padding: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>
                                        Key Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        placeholder="e.g. Production, Development, My App"
                                        style={inputStyle}
                                        autoFocus
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                                        Give your key a descriptive name so you can identify it later.
                                    </p>
                                </div>

                                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setShowNewKeyModal(false)}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#d1d5db', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateKey}
                                        disabled={creatingKey}
                                        style={{
                                            flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                                            background: creatingKey ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: 'white', cursor: creatingKey ? 'not-allowed' : 'pointer',
                                            fontWeight: 600, fontSize: '0.875rem',
                                        }}
                                    >
                                        {creatingKey ? "Generating..." : "Generate Key"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            // Step 2: Show the key (once only)
                            <>
                                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={20} style={{ color: '#10b981' }} />
                                        API Key Created
                                    </h2>
                                </div>

                                <div style={{ padding: '1.5rem' }}>
                                    {/* Warning */}
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                        padding: '1rem', borderRadius: '0.5rem',
                                        background: 'rgba(245, 158, 11, 0.08)',
                                        border: '1px solid rgba(245, 158, 11, 0.2)',
                                        marginBottom: '1.25rem',
                                    }}>
                                        <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.125rem' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Save this key now!</div>
                                            <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                                                This is the only time you'll see this key. Copy it and store it securely.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key display */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem',
                                        padding: '0.875rem 1rem',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                    }}>
                                        <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8125rem', color: '#a5b4fc', wordBreak: 'break-all' }}>
                                            {revealedKey}
                                        </code>
                                        <button
                                            onClick={() => handleCopyKey(revealedKey)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '2.25rem', height: '2.25rem', borderRadius: '0.375rem',
                                                border: '1px solid rgba(99,102,241,0.3)',
                                                background: copySuccess ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                                color: copySuccess ? '#10b981' : '#818cf8',
                                                cursor: 'pointer', flexShrink: 0,
                                            }}
                                            title="Copy to clipboard"
                                        >
                                            {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button
                                        onClick={() => { setShowNewKeyModal(false); setRevealedKey(null); }}
                                        style={{
                                            width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                                        }}
                                    >
                                        I've Saved My Key — Done
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
