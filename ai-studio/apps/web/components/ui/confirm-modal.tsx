"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";

// ============================================================
// Styled Confirm Modal — replaces browser confirm() dialogs
// ============================================================

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
}

type ConfirmResolver = (value: boolean) => void;

let showConfirmGlobal: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

// Call this from anywhere in the app — no hooks needed
export function styledConfirm(options: ConfirmOptions): Promise<boolean> {
    if (showConfirmGlobal) return showConfirmGlobal(options);
    // Fallback to native confirm if component not mounted
    return Promise.resolve(window.confirm(options.message));
}

export function ConfirmModal() {
    const [open, setOpen] = useState(false);
    const [opts, setOpts] = useState<ConfirmOptions>({
        title: "",
        message: "",
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        variant: "danger",
    });
    const [resolver, setResolver] = useState<ConfirmResolver | null>(null);

    showConfirmGlobal = useCallback(
        (options: ConfirmOptions) => {
            return new Promise<boolean>((resolve) => {
                setOpts({
                    title: options.title,
                    message: options.message,
                    confirmLabel: options.confirmLabel || "Confirm",
                    cancelLabel: options.cancelLabel || "Cancel",
                    variant: options.variant || "danger",
                });
                setResolver(() => resolve);
                setOpen(true);
            });
        },
        []
    );

    const handleClose = (result: boolean) => {
        setOpen(false);
        resolver?.(result);
        setResolver(null);
    };

    if (!open) return null;

    const variantColors = {
        danger: { accent: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", btnBg: "#ef4444" },
        warning: { accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)", btnBg: "#f59e0b" },
        info: { accent: "#6366f1", bg: "rgba(99, 102, 241, 0.1)", border: "rgba(99, 102, 241, 0.3)", btnBg: "#6366f1" },
    };
    const colors = variantColors[opts.variant || "danger"];

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(8px)",
                animation: "confirmFadeIn 0.2s ease-out",
            }}
            onClick={() => handleClose(false)}
        >
            <style>{`
                @keyframes confirmFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes confirmSlideIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    margin: "1rem",
                    borderRadius: "1rem",
                    border: `1px solid ${colors.border}`,
                    backgroundColor: "#0f0f1e",
                    boxShadow: `0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 30px ${colors.accent}15`,
                    animation: "confirmSlideIn 0.25s ease-out",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "1.5rem 1.5rem 0",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                    }}
                >
                    <div
                        style={{
                            width: "2.5rem",
                            height: "2.5rem",
                            borderRadius: "0.75rem",
                            backgroundColor: colors.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <AlertTriangle size={20} style={{ color: colors.accent }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3
                            style={{
                                fontSize: "1.125rem",
                                fontWeight: 700,
                                color: "white",
                                marginBottom: "0.5rem",
                                lineHeight: 1.3,
                            }}
                        >
                            {opts.title}
                        </h3>
                        <p
                            style={{
                                fontSize: "0.875rem",
                                color: "#9ca3af",
                                lineHeight: 1.6,
                            }}
                        >
                            {opts.message}
                        </p>
                    </div>
                    <button
                        onClick={() => handleClose(false)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            padding: "0.25rem",
                            flexShrink: 0,
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Actions */}
                <div
                    style={{
                        display: "flex",
                        gap: "0.75rem",
                        padding: "1.5rem",
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        onClick={() => handleClose(false)}
                        style={{
                            padding: "0.625rem 1.25rem",
                            borderRadius: "0.5rem",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "#d1d5db",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                        }}
                    >
                        {opts.cancelLabel}
                    </button>
                    <button
                        onClick={() => handleClose(true)}
                        style={{
                            padding: "0.625rem 1.25rem",
                            borderRadius: "0.5rem",
                            border: "none",
                            backgroundColor: colors.btnBg,
                            color: "white",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            transition: "all 0.2s ease",
                            boxShadow: `0 4px 12px ${colors.accent}40`,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = "0.9";
                            e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = "1";
                            e.currentTarget.style.transform = "translateY(0)";
                        }}
                    >
                        {opts.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
