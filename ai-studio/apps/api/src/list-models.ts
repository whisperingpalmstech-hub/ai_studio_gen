import { supabaseAdmin } from './services/supabase.js';

async function listModels() {
    const { data: models, error } = await (supabaseAdmin.from('models') as any).select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(models, null, 2));
}

listModels();
