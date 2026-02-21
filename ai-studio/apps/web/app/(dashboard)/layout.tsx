"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Sparkles,
    LayoutDashboard,
    ImageIcon,
    Video,
    Layers,
    FolderOpen,
    Settings,
    User,
    CreditCard,
    ChevronDown,
    Zap,
    Plus,
    Menu,
    X,
    Code2,
    BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useCredits } from "@/lib/hooks/use-credits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useI18n } from "@/lib/i18n";

const navigation = [
    { name: "Dashboard", translationKey: "navDashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Generate", translationKey: "navGenerate", href: "/dashboard/generate", icon: Sparkles },
    { name: "Generate Video", translationKey: "navGenerateVideo", href: "/dashboard/generate-video", icon: Video },
    { name: "Gallery", translationKey: "navGallery", href: "/dashboard/gallery", icon: ImageIcon },
    { name: "Workflows", translationKey: "navWorkflows", href: "/dashboard/workflows", icon: Layers },
    { name: "Models", translationKey: "navModels", href: "/dashboard/models", icon: FolderOpen },
    { name: "API Docs", translationKey: "navApiDocs", href: "/dashboard/api-docs", icon: Code2 },
];

const bottomNavigation = [
    { name: "Settings", translationKey: "navSettings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { language, setLanguage, t } = useI18n();
    const pathname = usePathname();
    const { credits, tier, loading, refresh } = useCredits();
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Close mobile menu on navigation
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const getNavItemStyle = (isActive: boolean): React.CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        borderRadius: "0.625rem",
        padding: "0.625rem 0.75rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        textDecoration: "none",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: isActive ? "rgba(99, 102, 241, 0.12)" : "transparent",
        color: isActive ? "#a5b4fc" : "#9ca3af",
        borderLeft: isActive ? "3px solid #818cf8" : "3px solid transparent",
    });

    const sidebarContent = (
        <>
            {/* Logo */}
            <Link
                href="/"
                style={{
                    display: "flex",
                    height: "4rem",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0 1.5rem",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    color: "white",
                    textDecoration: "none",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        height: "2.25rem",
                        width: "2.25rem",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "0.625rem",
                        background: "linear-gradient(135deg, #6366f1, #a855f7)",
                        boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                    }}
                >
                    <Sparkles style={{ width: "1.25rem", height: "1.25rem", color: "white" }} />
                </div>
                <div>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "white", letterSpacing: "-0.025em" }}>
                        AI Studio
                    </span>
                    <div style={{ fontSize: "0.625rem", color: "#6b7280", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                        {t('enterprise')}
                    </div>
                </div>
            </Link>

            {/* Top Language Toggle */}
            <div style={{ padding: "0 1rem 1rem", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#9ca3af',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        outline: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '1em'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#9ca3af';
                    }}
                >
                    <option value="en" style={{ color: 'white', background: '#0f0f23', padding: '10px' }}>English (EN)</option>
                    <option value="hi" style={{ color: 'white', background: '#0f0f23', padding: '10px' }}>Hindi (HI)</option>
                    <option value="mr" style={{ color: 'white', background: '#0f0f23' }}>Marathi (MR)</option>
                    <option value="es" style={{ color: 'white', background: '#0f0f23' }}>Spanish (ES)</option>
                    <option value="fr" style={{ color: 'white', background: '#0f0f23' }}>French (FR)</option>
                    <option value="de" style={{ color: 'white', background: '#0f0f23' }}>German (DE)</option>
                    <option value="zh" style={{ color: 'white', background: '#0f0f23' }}>Chinese (ZH)</option>
                    <option value="ja" style={{ color: 'white', background: '#0f0f23' }}>Japanese (JA)</option>
                    <option value="ar" style={{ color: 'white', background: '#0f0f23' }}>Arabic (AR)</option>
                    <option value="ru" style={{ color: 'white', background: '#0f0f23' }}>Russian (RU)</option>
                    <option value="pt" style={{ color: 'white', background: '#0f0f23' }}>Portuguese (PT)</option>
                    <option value="it" style={{ color: 'white', background: '#0f0f23' }}>Italian (IT)</option>
                    <option value="ko" style={{ color: 'white', background: '#0f0f23' }}>Korean (KO)</option>
                </select>
            </div>

            {/* Quick Action */}
            <div style={{ padding: "1.25rem 1rem" }}>
                <Link href="/dashboard/generate" style={{ textDecoration: "none" }}>
                    <button
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "100%",
                            padding: "0.75rem 1rem",
                            borderRadius: "0.625rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: "none",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            color: "white",
                            boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                            transition: "all 0.2s ease",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        <Plus style={{ marginRight: "0.5rem", width: "1rem", height: "1rem" }} />
                        {t('newGeneration')}
                    </button>
                </Link>
            </div>

            {/* Main Navigation */}
            <nav style={{ flex: 1, padding: "0 0.5rem", display: "flex", flexDirection: "column", gap: "0.125rem", overflowY: "auto" }}>
                <div style={{ padding: "0 0.75rem 0.5rem", fontSize: "0.6875rem", fontWeight: 600, color: "#4b5563", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    {t('workspace')}
                </div>
                {navigation.slice(0, 6).map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                    return (
                        <Link key={item.name} href={item.href} style={getNavItemStyle(isActive)}>
                            <item.icon style={{ width: "1.125rem", height: "1.125rem" }} />
                            {item.translationKey ? t(item.translationKey) : item.name}
                        </Link>
                    );
                })}

                <div style={{ padding: "1rem 0.75rem 0.5rem 0.75rem", fontSize: "0.6875rem", fontWeight: 600, color: "#4b5563", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                    {t('developer')}
                </div>
                {navigation.slice(6).map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link key={item.name} href={item.href} style={getNavItemStyle(isActive)}>
                            <item.icon style={{ width: "1.125rem", height: "1.125rem" }} />
                            {item.translationKey ? t(item.translationKey) : item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Navigation */}
            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                {bottomNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.name} href={item.href} style={getNavItemStyle(isActive)}>
                            <item.icon style={{ width: "1.125rem", height: "1.125rem" }} />
                            {item.translationKey ? t(item.translationKey) : item.name}
                        </Link>
                    );
                })}
            </div>

            {/* Credits Card */}
            <div style={{ padding: "0.75rem", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div
                    style={{
                        borderRadius: "0.75rem",
                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))",
                        border: "1px solid rgba(99, 102, 241, 0.15)",
                        padding: "1rem",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{t('credits')}</span>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "1.5rem", height: "1.5rem", borderRadius: "50%", background: "rgba(99, 102, 241, 0.2)" }}>
                            <Zap style={{ width: "0.75rem", height: "0.75rem", color: "#818cf8" }} />
                        </div>
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.125rem", color: "white", letterSpacing: "-0.025em" }}>
                        {loading ? (
                            <span style={{ display: "inline-block", width: "3rem", height: "1.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "0.375rem", animation: "pulse 2s infinite" }} />
                        ) : (
                            credits?.toLocaleString() ?? "0"
                        )}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                        {tier === "pro" ? t('proPlan') : tier === "enterprise" ? t('enterpriseUnlimited') : t('freeTier')}
                    </div>
                    {/* Credit bar */}
                    <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", marginBottom: "0.75rem", overflow: "hidden" }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${Math.min(((credits || 0) / (tier === "pro" ? 1000 : 100)) * 100, 100)}%`,
                                background: "linear-gradient(90deg, #6366f1, #a855f7)",
                                borderRadius: "2px",
                                transition: "width 0.5s ease",
                            }}
                        />
                    </div>
                    <button
                        onClick={() => setIsUpgradeOpen(true)}
                        style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.375rem",
                            padding: "0.5rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#a5b4fc",
                            background: "rgba(99, 102, 241, 0.1)",
                            border: "1px solid rgba(99, 102, 241, 0.2)",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            marginBottom: "0.5rem"
                        }}
                    >
                        <CreditCard style={{ width: "0.75rem", height: "0.75rem" }} />
                        {tier === "pro" ? t('managePlan') : t('upgradePlan')}
                    </button>


                </div>
            </div>

            {/* User Menu */}
            <div style={{ padding: "0.75rem", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <button
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 0.625rem",
                        borderRadius: "0.625rem",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left" as const,
                        transition: "all 0.2s ease",
                    }}
                >
                    <div
                        style={{
                            height: "2rem",
                            width: "2rem",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #818cf8, #a855f7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(129, 140, 248, 0.3)",
                        }}
                    >
                        <User style={{ width: "0.875rem", height: "0.875rem", color: "white" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "white" }}>{t('user')}</div>
                        <div style={{ fontSize: "0.6875rem", color: "#6b7280" }}>
                            {tier === "pro" ? t('pro') : tier === "enterprise" ? t('enterprise') : t('free')}
                        </div>
                    </div>
                    <ChevronDown style={{ width: "0.875rem", height: "0.875rem", color: "#6b7280" }} />
                </button>
            </div>
        </>
    );

    return (
        <div style={{ minHeight: "100vh", display: "flex", backgroundColor: "hsl(222, 47%, 6%)" }}>
            {/* Mobile Header */}
            {isMobile && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        height: "3.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 1rem",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        backgroundColor: "rgba(15, 15, 35, 0.95)",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div
                            style={{
                                display: "flex",
                                height: "1.75rem",
                                width: "1.75rem",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "0.5rem",
                                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            }}
                        >
                            <Sparkles style={{ width: "1rem", height: "1rem", color: "white" }} />
                        </div>
                        <span style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>AI Studio</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {/* Mobile Language Toggle */}
                        <select
                            value={language}
                            onChange={(e) => {
                                e.stopPropagation();
                                setLanguage(e.target.value as any);
                            }}
                            style={{
                                padding: '0.375rem 1.5rem 0.375rem 0.5rem',
                                borderRadius: '0.375rem',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#9ca3af',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                outline: 'none',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.375rem center',
                                backgroundSize: '0.8em'
                            }}
                        >
                            <option value="en" style={{ color: 'white', background: '#0f0f23' }}>EN</option>
                            <option value="hi" style={{ color: 'white', background: '#0f0f23' }}>HI</option>
                            <option value="mr" style={{ color: 'white', background: '#0f0f23' }}>MR</option>
                            <option value="es" style={{ color: 'white', background: '#0f0f23' }}>ES</option>
                            <option value="fr" style={{ color: 'white', background: '#0f0f23' }}>FR</option>
                            <option value="de" style={{ color: 'white', background: '#0f0f23' }}>DE</option>
                            <option value="zh" style={{ color: 'white', background: '#0f0f23' }}>ZH</option>
                            <option value="ja" style={{ color: 'white', background: '#0f0f23' }}>JA</option>
                            <option value="ar" style={{ color: 'white', background: '#0f0f23' }}>AR</option>
                            <option value="ru" style={{ color: 'white', background: '#0f0f23' }}>RU</option>
                            <option value="pt" style={{ color: 'white', background: '#0f0f23' }}>PT</option>
                            <option value="it" style={{ color: 'white', background: '#0f0f23' }}>IT</option>
                            <option value="ko" style={{ color: 'white', background: '#0f0f23' }}>KO</option>
                        </select>

                        {/* Mobile credit badge */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.375rem",
                            padding: "0.25rem 0.625rem",
                            borderRadius: "1rem",
                            background: "rgba(99, 102, 241, 0.1)",
                            border: "1px solid rgba(99, 102, 241, 0.2)",
                        }}>
                            <Zap style={{ width: "0.75rem", height: "0.75rem", color: "#818cf8" }} />
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#a5b4fc" }}>
                                {loading ? "..." : credits?.toLocaleString() ?? "0"}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "2.25rem",
                                height: "2.25rem",
                                borderRadius: "0.5rem",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "white",
                                cursor: "pointer",
                            }}
                        >
                            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Menu Overlay */}
            {isMobile && isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 45,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(4px)",
                    }}
                />
            )}

            {/* Sidebar - Desktop: fixed | Mobile: slide-over */}
            <aside
                style={{
                    position: "fixed",
                    left: 0,
                    top: isMobile ? "3.5rem" : 0,
                    zIndex: isMobile ? 50 : 40,
                    height: isMobile ? "calc(100vh - 3.5rem)" : "100vh",
                    width: "16rem",
                    borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                    backgroundColor: "rgba(12, 12, 30, 0.97)",
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    flexDirection: "column",
                    transform: isMobile
                        ? isMobileMenuOpen
                            ? "translateX(0)"
                            : "translateX(-100%)"
                        : "translateX(0)",
                    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflowY: "auto",
                }}
            >
                {sidebarContent}
            </aside>

            {/* Main Content */}
            <main
                style={{
                    flex: 1,
                    marginLeft: isMobile ? 0 : "16rem",
                    paddingTop: isMobile ? "4.5rem" : "1.5rem",
                    paddingLeft: isMobile ? "1rem" : "2rem",
                    paddingRight: isMobile ? "1rem" : "2rem",
                    paddingBottom: "2rem",
                    minHeight: "100vh",
                    transition: "margin-left 0.3s ease",
                }}
            >
                {children}
            </main>

            <UpgradeModal
                isOpen={isUpgradeOpen}
                onClose={() => setIsUpgradeOpen(false)}
                currentTier={tier}
                onSuccess={refresh}
            />
        </div>
    );
}
