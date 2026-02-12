import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../supabase/client';

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [tier, setTier] = useState<string>('free');
    const [loading, setLoading] = useState(true);

    const fetchCredits = async () => {
        try {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('credits, tier')
                    .eq('id', user.id)
                    .single();

                // If profile not found (PGRST116), initialize it
                if (error && error.code === 'PGRST116') {
                    await fetch('/api/user/init', { method: 'POST' });
                    // Retry
                    const { data: newProfile } = await supabase
                        .from('profiles')
                        .select('credits, tier')
                        .eq('id', user.id)
                        .single();
                    if (newProfile) {
                        setCredits(newProfile.credits);
                        setTier(newProfile.tier);
                    }
                } else if (profile) {
                    setCredits(profile.credits);
                    setTier(profile.tier);
                }
            }
        } catch (error) {
            console.error('Error fetching credits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCredits();

        const supabase = getSupabaseClient();
        const channel = supabase
            .channel('public:profiles')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                const newProfile = payload.new as any;
                setCredits(newProfile.credits);
                setTier(newProfile.tier);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { credits, tier, loading, refresh: fetchCredits };
}
