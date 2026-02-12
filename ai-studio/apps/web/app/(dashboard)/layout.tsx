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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCredits } from "@/lib/hooks/use-credits";
import { UpgradeModal } from "@/components/UpgradeModal";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Generate", href: "/dashboard/generate", icon: Sparkles },
    { name: "Generate Video", href: "/dashboard/generate-video", icon: Video },
    { name: "Gallery", href: "/dashboard/gallery", icon: ImageIcon },
    { name: "Workflows", href: "/dashboard/workflows", icon: Layers },
    { name: "Models", href: "/dashboard/models", icon: FolderOpen },
];

const bottomNavigation = [
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];



export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { credits, tier, loading, refresh } = useCredits();
    const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

    const sidebarStyle: React.CSSProperties = {
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
        height: '100vh',
        width: '16rem',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 15, 35, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
    };

    const logoStyle: React.CSSProperties = {
        display: 'flex',
        height: '4rem',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        textDecoration: 'none',
    };

    const getNavItemStyle = (isActive: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        borderRadius: '0.5rem',
        padding: '0.625rem 0.75rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        color: isActive ? '#818cf8' : '#9ca3af',
    });

    const buttonStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '0.625rem 1rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        color: 'white',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'hsl(222, 47%, 6%)' }}>
            {/* Sidebar */}
            <aside style={sidebarStyle}>
                {/* Logo */}
                <Link href="/" style={logoStyle}>
                    <div style={{
                        display: 'flex',
                        height: '2.25rem',
                        width: '2.25rem',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0.5rem',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)'
                    }}>
                        <Sparkles style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
                    </div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>AI Studio</span>
                </Link>

                {/* Quick Action */}
                <div style={{ padding: '1.5rem' }}>
                    <Link href="/dashboard/generate" style={{ textDecoration: 'none' }}>
                        <button style={buttonStyle}>
                            <Plus style={{ marginRight: '0.5rem', width: '1rem', height: '1rem' }} />
                            New Generation
                        </button>
                    </Link>
                </div>

                {/* Main Navigation */}
                <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                style={getNavItemStyle(isActive)}
                            >
                                <item.icon style={{ width: '1.25rem', height: '1.25rem' }} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Navigation */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {bottomNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                style={getNavItemStyle(isActive)}
                            >
                                <item.icon style={{ width: '1.25rem', height: '1.25rem' }} />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Credits Card */}
                <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        padding: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Credits</span>
                            <Zap style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem', color: 'white' }}>
                            {loading ? '...' : credits}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                            {tier === 'pro' ? 'Pro Plan • 1000/mo' : 'Free tier • Resets monthly'}
                        </div>
                        <button
                            onClick={() => setIsUpgradeOpen(true)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                fontSize: '0.75rem',
                                color: 'white',
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '0.375rem',
                                cursor: 'pointer'
                            }}
                        >
                            <CreditCard style={{ width: '0.75rem', height: '0.75rem' }} />
                            {tier === 'pro' ? 'Manage Plan' : 'Upgrade Plan'}
                        </button>
                    </div>
                </div>

                {/* User Menu */}
                <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <button style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left'
                    }}>
                        <div style={{
                            height: '2rem',
                            width: '2rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #818cf8, #a855f7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User style={{ width: '1rem', height: '1rem', color: 'white' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'white' }}>User</div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{tier === 'pro' ? 'Pro' : 'Free'}</div>
                        </div>
                        <ChevronDown style={{ width: '1rem', height: '1rem', color: '#9ca3af' }} />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, marginLeft: '16rem', padding: '2rem' }}>
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
