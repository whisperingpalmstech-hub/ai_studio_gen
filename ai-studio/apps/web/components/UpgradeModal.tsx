"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

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
        try {
            const response = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier: 'pro' })
            });

            if (response.ok) {
                alert("Upgrade successful! Imperial credits added.");
                onSuccess();
                onClose();
            } else {
                const data = await response.json();
                alert(`Upgrade failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Upgrade error:", error);
            alert("Upgrade failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#1f2937', borderRadius: '1rem',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '2rem', maxWidth: '900px', width: '90%',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                    <X />
                </button>

                <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem', color: 'white' }}>
                    Choose Your Plan
                </h2>
                <p style={{ textAlign: 'center', color: '#9ca3af', marginBottom: '2rem' }}>
                    Unlock the full potential of AI Studio with our Pro plan.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: currentTier === 'pro' ? '1fr' : '1fr 1fr', gap: '2rem' }}>
                    {/* Free Plan */}
                    <div style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '0.75rem', padding: '1.5rem',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        opacity: currentTier === 'free' ? 1 : 0.5,
                        display: currentTier === 'pro' ? 'none' : 'block'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Free</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
                            $0<span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 'normal' }}>/mo</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#4ade80" /> 25 Credits / Month</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#4ade80" /> Standard Generation Speed</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#4ade80" /> Public Generations</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#4ade80" /> 1 Concurrent Job</li>
                        </ul>
                        {currentTier === 'free' && (
                            <button disabled style={{
                                width: '100%', marginTop: '1.5rem', padding: '0.75rem',
                                borderRadius: '0.5rem', background: 'rgba(255,255,255,0.1)',
                                color: '#9ca3af', border: 'none', cursor: 'not-allowed'
                            }}>Current Plan</button>
                        )}
                    </div>

                    {/* Pro Plan */}
                    <div style={{
                        border: '1px solid #a855f7',
                        borderRadius: '0.75rem', padding: '1.5rem',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        position: 'relative',
                        transform: currentTier === 'free' ? 'scale(1.02)' : 'none',
                        gridColumn: currentTier === 'pro' ? '1 / -1' : 'auto'
                    }}>
                        {currentTier === 'free' && (
                            <div style={{
                                position: 'absolute', top: '-0.75rem', left: '50%', transform: 'translateX(-50%)',
                                backgroundColor: '#a855f7', color: 'white', padding: '0.25rem 0.75rem',
                                borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold'
                            }}>RECOMMENDED</div>
                        )}
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Pro Plan</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
                            $29<span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 'normal' }}>/mo</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#d1d5db', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#a855f7" /> 1000 Credits / Month</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#a855f7" /> Fast Generation (Priority)</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#a855f7" /> Private Generations</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#a855f7" /> 3 Concurrent Jobs</li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Check size={16} color="#a855f7" /> High Resolution Support</li>
                        </ul>
                        <button
                            onClick={handleUpgrade}
                            disabled={currentTier === 'pro' || loading}
                            style={{
                                width: '100%', marginTop: '1.5rem', padding: '0.75rem',
                                borderRadius: '0.5rem',
                                background: currentTier === 'pro' ? 'rgba(74, 222, 128, 0.2)' : 'linear-gradient(135deg, #a855f7, #ec4899)',
                                color: currentTier === 'pro' ? '#4ade80' : 'white',
                                border: 'none', cursor: currentTier === 'pro' ? 'default' : 'pointer',
                                fontWeight: 'bold',
                                transition: 'opacity 0.2s'
                            }}
                        >
                            {loading ? 'Processing...' : currentTier === 'pro' ? 'Active Plan' : 'Upgrade to Pro'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
