"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, Globe, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    className?: string;
    placeholderMode?: boolean;
}

const LANGUAGES = [
    { code: 'en-US', label: 'English' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'mr-IN', label: 'Marathi' },
    { code: 'es-ES', label: 'Spanish' },
    { code: 'fr-FR', label: 'French' },
    { code: 'de-DE', label: 'German' },
    { code: 'zh-CN', label: 'Chinese' },
    { code: 'ja-JP', label: 'Japanese' },
    { code: 'ar-SA', label: 'Arabic' },
    { code: 'ru-RU', label: 'Russian' },
    { code: 'pt-PT', label: 'Portuguese' },
    { code: 'it-IT', label: 'Italian' },
    { code: 'ko-KR', label: 'Korean' },
];

export function VoiceInput({ onTranscript, className = '', placeholderMode = false }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const { language: globalLanguage, setLanguage: setGlobalLanguage } = useI18n();
    const [localVoiceLang, setLocalVoiceLang] = useState('hi-IN');
    const [showDropdown, setShowDropdown] = useState(false);
    const [status, setStatus] = useState<'' | 'success' | 'error'>('');
    const [tempTranscript, setTempTranscript] = useState('');

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Load preference
        const savedLang = localStorage.getItem('voice_lang_pref');
        // if (savedLang) handleVoiceLangChange(savedLang);
        // We will just let global layout handle it, but if VoiceInput was loaded alone we could.
        // For now let's just use localVoiceLang from prop sync, so we can ignore localStorage logic 
        // because global hook (useI18n) does the localStorage logic!

        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;
            }
        }
    }, []);

    useEffect(() => {
        // Sync local voice lang to global UI lang
        if (globalLanguage === 'hi') setLocalVoiceLang('hi-IN');
        else if (globalLanguage === 'mr') setLocalVoiceLang('mr-IN');
        else if (globalLanguage === 'es') setLocalVoiceLang('es-ES');
        else if (globalLanguage === 'fr') setLocalVoiceLang('fr-FR');
        else if (globalLanguage === 'de') setLocalVoiceLang('de-DE');
        else if (globalLanguage === 'zh') setLocalVoiceLang('zh-CN');
        else if (globalLanguage === 'ja') setLocalVoiceLang('ja-JP');
        else if (globalLanguage === 'ar') setLocalVoiceLang('ar-SA');
        else if (globalLanguage === 'ru') setLocalVoiceLang('ru-RU');
        else if (globalLanguage === 'pt') setLocalVoiceLang('pt-PT');
        else if (globalLanguage === 'it') setLocalVoiceLang('it-IT');
        else if (globalLanguage === 'ko') setLocalVoiceLang('ko-KR');
        else setLocalVoiceLang('en-US');
    }, [globalLanguage]);

    const handleVoiceLangChange = (code: string) => {
        setLocalVoiceLang(code);
        if (code === 'hi-IN') setGlobalLanguage('hi');
        else if (code === 'mr-IN') setGlobalLanguage('mr');
        else if (code === 'es-ES') setGlobalLanguage('es');
        else if (code === 'fr-FR') setGlobalLanguage('fr');
        else if (code === 'de-DE') setGlobalLanguage('de');
        else if (code === 'zh-CN') setGlobalLanguage('zh');
        else if (code === 'ja-JP') setGlobalLanguage('ja');
        else if (code === 'ar-SA') setGlobalLanguage('ar');
        else if (code === 'ru-RU') setGlobalLanguage('ru');
        else if (code === 'pt-PT') setGlobalLanguage('pt');
        else if (code === 'it-IT') setGlobalLanguage('it');
        else if (code === 'ko-KR') setGlobalLanguage('ko');
        else setGlobalLanguage('en');
    };

    const toggleListen = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if (!recognitionRef.current) {
            alert("Your browser doesn't support the Web Speech API. Please try Chrome, Edge, or Safari.");
            return;
        }

        setStatus('');
        setTempTranscript('');
        recognitionRef.current.lang = localVoiceLang;

        recognitionRef.current.onstart = () => {
            setIsListening(true);
        };

        recognitionRef.current.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (final) {
                setTempTranscript(final);
                processTranscript(final);
            } else {
                setTempTranscript(interim);
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                setIsListening(false);
                return;
            }
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            setStatus('error');
            setTimeout(() => setStatus(''), 2000);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };

        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error("Could not start recognition", e);
            if (isListening) {
                recognitionRef.current.stop();
                setTimeout(() => recognitionRef.current.start(), 400);
            }
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    const processTranscript = async (text: string) => {
        if (!text.trim()) return;

        setIsProcessing(true);
        try {
            // Translate if not English
            if (localVoiceLang !== 'en-US' && localVoiceLang !== 'en-IN') {
                const res = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        sourceLang: localVoiceLang.split('-')[0],
                        targetLang: 'en'
                    })
                });

                if (!res.ok) throw new Error("API Route Failed");

                const data = await res.json();
                if (data.translatedText) {
                    onTranscript(data.translatedText + " ");
                } else {
                    onTranscript(text + " ");
                }
            } else {
                onTranscript(text + " ");
            }
            setStatus('success');
            setTimeout(() => setStatus(''), 2000);
        } catch (error) {
            console.error("Translation Error:", error);
            onTranscript(text + " "); // Fallback to raw text
            setStatus('error');
            setTimeout(() => setStatus(''), 2000);
        } finally {
            setIsProcessing(false);
            setTempTranscript('');
        }
    };

    const handleLangChange = (code: string) => {
        handleVoiceLangChange(code);
        setShowDropdown(false);
    };

    return (
        <div className={`relative flex items-center ${className}`} style={{ gap: '0.25rem', zIndex: 30 }}>
            {tempTranscript && isListening && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: '0',
                    marginBottom: '0.5rem',
                    background: 'rgba(0,0,0,0.85)',
                    color: '#a78bfa',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    zIndex: 20,
                    animation: 'pulse 1.5s infinite'
                }}>
                    Listening ({localVoiceLang.split('-')[0].toUpperCase()}): {tempTranscript}
                </div>
            )}

            <div style={{ position: 'relative' }}>
                <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{
                        padding: '0.4rem',
                        background: 'transparent',
                        border: 'none',
                        color: showDropdown ? '#a855f7' : '#6b7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0.25rem',
                        transition: 'color 0.2s'
                    }}
                    title="Select Language"
                >
                    <Globe size={18} />
                </button>

                {showDropdown && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        marginBottom: '0.5rem',
                        background: '#1f2937',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        borderRadius: '0.5rem',
                        padding: '0.3rem',
                        zIndex: 50,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)'
                    }}>
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => handleLangChange(lang.code)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '0.5rem 1rem',
                                    background: localVoiceLang === lang.code ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                                    color: localVoiceLang === lang.code ? '#a855f7' : '#d1d5db',
                                    border: 'none',
                                    borderRadius: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={toggleListen}
                disabled={isProcessing}
                style={{
                    padding: '0.6rem',
                    background: isListening ? 'rgba(239, 68, 68, 0.15)' : (isProcessing ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)'),
                    border: '1px solid',
                    borderColor: isListening ? 'rgba(239, 68, 68, 0.3)' : (isProcessing ? 'rgba(168, 85, 247, 0.2)' : 'transparent'),
                    color: isListening ? '#ef4444' : (isProcessing ? '#a855f7' : (status === 'success' ? '#10b981' : (status === 'error' ? '#f59e0b' : '#9ca3af'))),
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'all 0.3s',
                    position: 'relative'
                }}
                title={isListening ? "Listening... Click to stop" : "Use Voice Input"}
            >
                {isProcessing ? (
                    <Loader2 size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                ) : status === 'success' ? (
                    <Check size={18} />
                ) : status === 'error' ? (
                    <AlertCircle size={18} />
                ) : (
                    <Mic size={18} />
                )}
            </button>
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
}
