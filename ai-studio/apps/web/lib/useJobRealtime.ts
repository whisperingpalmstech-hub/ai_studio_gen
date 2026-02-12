
import { useEffect, useState } from 'react';
import { getSupabaseClient } from './supabase/client';
import { Database } from "../../../packages/database/types";

type Job = Database['public']['Tables']['jobs']['Row'];

export function useJobRealtime(userId?: string) {
    const [jobs, setJobs] = useState<Record<string, Job>>({});
    const [lastUpdate, setLastUpdate] = useState<Job | null>(null);

    useEffect(() => {
        if (!userId) return;

        const supabase = getSupabaseClient();

        // 1. Subscribe to job changes
        const channel = supabase
            .channel(`public:jobs`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs',
                },
                (payload) => {
                    const updatedJob = payload.new as Job;
                    if (updatedJob.user_id !== userId) return;

                    setJobs((prev) => ({
                        ...prev,
                        [updatedJob.id]: updatedJob,
                    }));
                    setLastUpdate(updatedJob);
                    console.log('Job update received via Realtime:', updatedJob);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Subscribed to Realtime job updates');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return { jobs, lastUpdate };
}
