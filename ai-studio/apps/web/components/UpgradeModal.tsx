"use client";

import { Check, X, Crown, Sparkles, Zap, Shield } from "lucide-react";
import { useState } from "react";
import { enterpriseToast } from "@/components/ui/enterprise-toast";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTier: string;
    onSuccess: () => void;
}

export function UpgradeModal({ isOpen, onClose, currentTier, onSuccess }: UpgradeModalProps) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setLoading(true);
        const toastId = enterpriseToast.loading("Processing Upgrade", "Activating your Pro plan...");
        try {
            const response = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier: 'pro' })
            });

            if (response.ok) {
                enterpriseToast.update(toastId, {
                    type: "success",
                    title: "Welcome to Pro! 🎉",
                    description: "Your plan has been upgraded successfully. 1,000 credits added to your account.",
                    duration: 5000,
                });
                onSuccess();
                onClose();
            } else {
                const data = await response.json();
                enterpriseToast.update(toastId, {
                    type: "error",
                    title: "Upgrade Failed",
                    description: data.error || "Something went wrong. Please try again.",
                    duration: 6000,
                });
            }
        } catch (error) {
            console.error("Upgrade error:", error);
            enterpriseToast.update(toastId, {
                type: "error",
                title: "Connection Error",
                description: "Unable to process upgrade. Check your connection and try again.",
                duration: 6000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "1rem",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: "rgba(17, 17, 35, 0.98)",
                    borderRadius: "1.25rem",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "0",
                    maxWidth: "860px",
                    width: "100%",
                    position: "relative",
                    boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.08)",
                    overflow: "hidden",
                    maxHeight: "90vh",
                    overflowY: "auto" as const,
                }}
            >
                {/* Header gradient */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "200px",
                    background: "linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)",
                    pointerEvents: "none",
                }} />

                <button
                    onClick={onClose}
                    style={{
                        position: "absolute", top: "1.25rem", right: "1.25rem",
                        color: "#6b7280", background: "rgba(255,255,255,0.05)",
                        border: "none", cursor: "pointer", borderRadius: "0.5rem",
                        width: "2rem", height: "2rem", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s ease",
                        zIndex: 10,
                    }}
                >
                    <X size={16} />
                </button>

                <div style={{ padding: "2.5rem 2.5rem 2rem" }}>
                    <div style={{ textAlign: "center", marginBottom: "2rem", position: "relative" }}>
                        <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "3.5rem",
                            height: "3.5rem",
                            borderRadius: "1rem",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3)",
                            marginBottom: "1.25rem",
                        }}>
                            <Crown size={24} color="white" />
                        </div>
                        <h2 style={{
                            fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem",
                            color: "white", letterSpacing: "-0.03em",
                        }}>
                            Choose Your Plan
                        </h2>
                        <p style={{ color: "#6b7280", maxWidth: "24rem", margin: "0 auto", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                            Unlock the full potential of AI Studio with premium features
                        </p>
                    </div>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: currentTier === "pro" ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1.5rem",
                    }}>
                        {/* Free Plan */}
                        {currentTier !== "pro" && (
                            <div style={{
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                borderRadius: "1rem",
                                padding: "1.75rem",
                                backgroundColor: "rgba(255, 255, 255, 0.02)",
                                position: "relative",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <Zap size={18} color="#6b7280" />
                                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "white" }}>Free</h3>
                                </div>
                                <div style={{ marginBottom: "1.5rem" }}>
                                    <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "white" }}>$0</span>
                                    <span style={{ fontSize: "0.875rem", color: "#6b7280", marginLeft: "0.25rem" }}>/month</span>
                                </div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    {["100 Credits / Month", "Standard Speed", "512×512 Max Resolution", "2 Concurrent Jobs"].map((feat) => (
                                        <li key={feat} style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.875rem", color: "#9ca3af" }}>
                                            <Check size={16} color="#4ade80" style={{ flexShrink: 0 }} />
                                            {feat}
                                        </li>
                                    ))}
                                </ul>
                                {currentTier === "free" && (
                                    <button disabled style={{
                                        width: "100%", marginTop: "1.75rem", padding: "0.75rem",
                                        borderRadius: "0.625rem", background: "rgba(255, 255, 255, 0.05)",
                                        color: "#6b7280", border: "1px solid rgba(255, 255, 255, 0.06)",
                                        cursor: "not-allowed", fontWeight: 600, fontSize: "0.875rem",
                                    }}>Current Plan</button>
                                )}
                            </div>
                        )}

                        {/* Pro Plan */}
                        <div style={{
                            border: "1px solid rgba(168, 85, 247, 0.3)",
                            borderRadius: "1rem",
                            padding: "1.75rem",
                            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))",
                            position: "relative",
                            gridColumn: currentTier === "pro" ? "1 / -1" : "auto",
                        }}>
                            {currentTier === "free" && (
                                <div style={{
                                    position: "absolute", top: "-0.6875rem", left: "50%", transform: "translateX(-50%)",
                                    background: "linear-gradient(135deg, #a855f7, #ec4899)",
                                    color: "white", padding: "0.25rem 1rem",
                                    borderRadius: "1rem", fontSize: "0.6875rem", fontWeight: 700,
                                    letterSpacing: "0.05em", textTransform: "uppercase" as const,
                                    boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
                                }}>RECOMMENDED</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                <Crown size={18} color="#a855f7" />
                                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "white" }}>Pro</h3>
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "white" }}>$29</span>
                                <span style={{ fontSize: "0.875rem", color: "#6b7280", marginLeft: "0.25rem" }}>/month</span>
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {[
                                    "1,000 Credits / Month",
                                    "Priority Generation Speed",
                                    "2048×2048 Max Resolution",
                                    "5 Concurrent Jobs",
                                    "API Access",
                                    "Private Generations",
                                ].map((feat) => (
                                    <li key={feat} style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.875rem", color: "#d1d5db" }}>
                                        <Check size={16} color="#a855f7" style={{ flexShrink: 0 }} />
                                        {feat}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={handleUpgrade}
                                disabled={currentTier === "pro" || loading}
                                style={{
                                    width: "100%", marginTop: "1.75rem", padding: "0.875rem",
                                    borderRadius: "0.625rem",
                                    background: currentTier === "pro"
                                        ? "rgba(74, 222, 128, 0.1)"
                                        : "linear-gradient(135deg, #6366f1, #a855f7)",
                                    color: currentTier === "pro" ? "#4ade80" : "white",
                                    border: currentTier === "pro" ? "1px solid rgba(74, 222, 128, 0.2)" : "none",
                                    cursor: currentTier === "pro" ? "default" : "pointer",
                                    fontWeight: 700,
                                    fontSize: "0.9375rem",
                                    transition: "all 0.2s ease",
                                    boxShadow: currentTier === "pro" ? "none" : "0 4px 16px rgba(99, 102, 241, 0.3)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {loading ? "Processing..." : currentTier === "pro" ? "✓ Active Plan" : "Upgrade to Pro →"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
