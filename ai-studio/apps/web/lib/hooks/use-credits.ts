import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '../supabase/client';

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [tier, setTier] = useState<string>('free');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const fetchCredits = useCallback(async () => {
        try {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);
                const { data: profile, error } = await (supabase
                    .from('profiles') as any)
                    .select('credits, tier')
                    .eq('id', user.id)
                    .single();

                // If profile not found (PGRST116), try to initialize it
                if (error && error.code === 'PGRST116') {
                    // Try init — this fires the backend to create the profile
                    try {
                        await fetch('/api/user/init', { method: 'POST' });
                    } catch (initErr) {
                        console.warn('Profile init via API failed, profile may already exist or API is down');
                    }
                    // Retry reading the profile
                    const { data: newProfile } = await (supabase
                        .from('profiles') as any)
                        .select('credits, tier')
                        .eq('id', user.id)
                        .single();
                    if (newProfile) {
                        setCredits(newProfile.credits);
                        setTier(newProfile.tier);
                    } else {
                        // Fallback defaults — profile should exist from DB trigger
                        setCredits(100);
                        setTier('free');
                    }
                } else if (profile) {
                    setCredits(profile.credits);
                    setTier(profile.tier);
                } else {
                    // Profile query returned null but no specific error
                    setCredits(100);
                    setTier('free');
                }
            }
        } catch (error) {
            console.error('Error fetching credits:', error);
            // Set defaults on error
            setCredits(100);
            setTier('free');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    // Real-time subscription filtered by user ID
    useEffect(() => {
        if (!userId) return;

        const supabase = getSupabaseClient();
        const channel = supabase
            .channel(`profiles:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    const newProfile = payload.new as any;
                    if (newProfile.credits !== undefined) setCredits(newProfile.credits);
                    if (newProfile.tier) setTier(newProfile.tier);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return { credits, tier, loading, refresh: fetchCredits };
}
