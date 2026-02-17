"use client";

import * as React from "react";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    X,
    Loader2,
    Sparkles,
    Zap,
} from "lucide-react";

// =====================================================
// Enterprise Toast System
// =====================================================

interface ToastData {
    id: string;
    type: "success" | "error" | "warning" | "info" | "loading" | "generation";
    title: string;
    description?: string;
    duration?: number;
    image?: string;
    progress?: number;
    action?: { label: string; onClick: () => void };
}

const TOAST_LIMIT = 5;
const DEFAULT_DURATIONS: Record<string, number> = {
    success: 4000,
    error: 6000,
    warning: 5000,
    info: 4000,
    loading: 0, // Persistent until dismissed
    generation: 0, // Persistent until dismissed
};

let count = 0;
function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER;
    return `toast-${count}`;
}

// ── Global State ──
type Listener = (toasts: ToastData[]) => void;
let memoryState: ToastData[] = [];
const listeners: Listener[] = [];
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(toasts: ToastData[]) {
    memoryState = toasts;
    listeners.forEach((l) => l(memoryState));
}

function removeToast(id: string) {
    timeouts.delete(id);
    dispatch(memoryState.filter((t) => t.id !== id));
}

function addToast(toast: Omit<ToastData, "id">): string {
    const id = genId();
    const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type] ?? 4000;

    dispatch([{ ...toast, id }, ...memoryState].slice(0, TOAST_LIMIT));

    if (duration > 0) {
        const timeout = setTimeout(() => removeToast(id), duration);
        timeouts.set(id, timeout);
    }

    return id;
}

function updateToast(id: string, data: Partial<ToastData>) {
    dispatch(
        memoryState.map((t) => (t.id === id ? { ...t, ...data } : t))
    );

    // If updating to a type with a duration and it was previously persistent
    if (data.type && DEFAULT_DURATIONS[data.type] > 0 && !timeouts.has(id)) {
        const timeout = setTimeout(
            () => removeToast(id),
            data.duration ?? DEFAULT_DURATIONS[data.type]
        );
        timeouts.set(id, timeout);
    }
}

// ── Public API ──
export const enterpriseToast = {
    success: (title: string, description?: string, opts?: Partial<ToastData>) =>
        addToast({ type: "success", title, description, ...opts }),
    error: (title: string, description?: string, opts?: Partial<ToastData>) =>
        addToast({ type: "error", title, description, ...opts }),
    warning: (title: string, description?: string, opts?: Partial<ToastData>) =>
        addToast({ type: "warning", title, description, ...opts }),
    info: (title: string, description?: string, opts?: Partial<ToastData>) =>
        addToast({ type: "info", title, description, ...opts }),
    loading: (title: string, description?: string, opts?: Partial<ToastData>) =>
        addToast({ type: "loading", title, description, ...opts }),
    generation: (title: string, opts?: Partial<ToastData>) =>
        addToast({ type: "generation", title, ...opts }),
    update: updateToast,
    dismiss: removeToast,
    dismissAll: () => dispatch([]),
};

// ── Icons ──
const ICON_MAP: Record<string, React.ReactNode> = {
    success: <CheckCircle2 size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
    loading: <Loader2 size={20} className="animate-spin" />,
    generation: <Sparkles size={20} />,
};

const COLOR_MAP: Record<string, { bg: string; border: string; icon: string; glow: string }> = {
    success: {
        bg: "rgba(16, 185, 129, 0.08)",
        border: "rgba(16, 185, 129, 0.25)",
        icon: "#10b981",
        glow: "0 0 20px rgba(16, 185, 129, 0.15)",
    },
    error: {
        bg: "rgba(239, 68, 68, 0.08)",
        border: "rgba(239, 68, 68, 0.25)",
        icon: "#ef4444",
        glow: "0 0 20px rgba(239, 68, 68, 0.15)",
    },
    warning: {
        bg: "rgba(245, 158, 11, 0.08)",
        border: "rgba(245, 158, 11, 0.25)",
        icon: "#f59e0b",
        glow: "0 0 20px rgba(245, 158, 11, 0.15)",
    },
    info: {
        bg: "rgba(99, 102, 241, 0.08)",
        border: "rgba(99, 102, 241, 0.25)",
        icon: "#6366f1",
        glow: "0 0 20px rgba(99, 102, 241, 0.15)",
    },
    loading: {
        bg: "rgba(99, 102, 241, 0.08)",
        border: "rgba(99, 102, 241, 0.25)",
        icon: "#818cf8",
        glow: "0 0 20px rgba(99, 102, 241, 0.15)",
    },
    generation: {
        bg: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))",
        border: "rgba(168, 85, 247, 0.3)",
        icon: "#a855f7",
        glow: "0 0 25px rgba(168, 85, 247, 0.2)",
    },
};

// ── Single Toast Component ──
function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
    const [isExiting, setIsExiting] = React.useState(false);
    const [isEntering, setIsEntering] = React.useState(true);
    const colors = COLOR_MAP[toast.type] || COLOR_MAP.info;

    React.useEffect(() => {
        requestAnimationFrame(() => setIsEntering(false));
    }, []);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(onDismiss, 300);
    };

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "1rem 1.25rem",
                borderRadius: "0.875rem",
                border: `1px solid ${colors.border}`,
                background: typeof colors.bg === "string" && colors.bg.startsWith("linear")
                    ? colors.bg
                    : colors.bg,
                backgroundColor: typeof colors.bg === "string" && !colors.bg.startsWith("linear")
                    ? colors.bg
                    : undefined,
                backdropFilter: "blur(16px) saturate(180%)",
                boxShadow: `${colors.glow}, 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
                maxWidth: "420px",
                width: "100%",
                overflow: "hidden",
                transform: isEntering
                    ? "translateX(100%) scale(0.95)"
                    : isExiting
                        ? "translateX(120%) scale(0.9)"
                        : "translateX(0) scale(1)",
                opacity: isEntering ? 0 : isExiting ? 0 : 1,
                transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                pointerEvents: "auto",
            }}
        >
            {/* Progress bar for generation type */}
            {toast.type === "generation" && toast.progress !== undefined && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        height: "3px",
                        width: `${toast.progress}%`,
                        background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
                        borderRadius: "0 2px 0 0",
                        transition: "width 0.5s ease",
                    }}
                />
            )}

            {/* Icon */}
            <div
                style={{
                    flexShrink: 0,
                    color: colors.icon,
                    marginTop: "1px",
                }}
            >
                {ICON_MAP[toast.type]}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#f1f5f9",
                        lineHeight: 1.4,
                        letterSpacing: "-0.01em",
                    }}
                >
                    {toast.title}
                </div>
                {toast.description && (
                    <div
                        style={{
                            fontSize: "0.8125rem",
                            color: "#94a3b8",
                            marginTop: "0.25rem",
                            lineHeight: 1.5,
                        }}
                    >
                        {toast.description}
                    </div>
                )}
                {toast.action && (
                    <button
                        onClick={toast.action.onClick}
                        style={{
                            marginTop: "0.5rem",
                            padding: "0.25rem 0.75rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: colors.icon,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: `1px solid ${colors.border}`,
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                        }}
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>

            {/* Preview Image */}
            {toast.image && (
                <div
                    style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "0.5rem",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                >
                    <img
                        src={toast.image}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                </div>
            )}

            {/* Close */}
            <button
                onClick={handleDismiss}
                style={{
                    flexShrink: 0,
                    padding: "0.25rem",
                    color: "#64748b",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "0.25rem",
                    transition: "all 0.2s ease",
                    opacity: 0.6,
                    marginTop: "1px",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.color = "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.6";
                    e.currentTarget.style.color = "#64748b";
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}

// ── Toaster Container ──
export function EnterpriseToaster() {
    const [toasts, setToasts] = React.useState<ToastData[]>([]);

    React.useEffect(() => {
        listeners.push(setToasts);
        return () => {
            const idx = listeners.indexOf(setToasts);
            if (idx > -1) listeners.splice(idx, 1);
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                pointerEvents: "none",
                maxWidth: "420px",
                width: "100%",
            }}
        >
            {toasts.map((t) => (
                <ToastItem
                    key={t.id}
                    toast={t}
                    onDismiss={() => removeToast(t.id)}
                />
            ))}
        </div>
    );
}
