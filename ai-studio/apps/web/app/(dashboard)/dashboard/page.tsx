
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch Stats in parallel
    const [
        { count: generationCount },
        { count: workflowCount },
        { data: profile },
        { data: recentGenerations }
    ] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'image'),
        supabase.from('workflows').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('profiles').select('credits').eq('id', user.id).single(),
        supabase.from('assets').select('*').eq('user_id', user.id).eq('type', 'image').order('created_at', { ascending: false }).limit(4)
    ]);

    const credits = (profile as any)?.credits || 0;
    const timeSaved = Math.round((generationCount || 0) * 0.5); // Assume 30 mins saved per image vs manual creation
    const gens = (recentGenerations as any[]) || [];

    return <DashboardClient generationCount={generationCount} workflowCount={workflowCount} credits={credits} timeSaved={timeSaved} gens={gens} />;
}
