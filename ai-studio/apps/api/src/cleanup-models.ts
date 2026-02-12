import { supabaseAdmin } from './services/supabase.js';

async function cleanupModels() {
    console.log('Fetching all models...');
    const { data: models, error: fetchError } = await (supabaseAdmin.from('models') as any).select('*');

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    console.log(`Found ${models.length} models.`);

    // Group by name to identify duplicates
    const nameGroups: Record<string, any[]> = {};
    models.forEach(m => {
        if (!nameGroups[m.name]) nameGroups[m.name] = [];
        nameGroups[m.name].push(m);
    });

    const idsToDelete: string[] = [];
    const validFiles = [
        'wan2.1_i2v_720p_14B_bf16.safetensors',
        'wan2.1_t2v_1.3B_bf16.safetensors',
        'wan_2.1_vae.safetensors',
        'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
        'clip_vision_h.safetensors',
        'sd_xl_base_1.0.safetensors',
        'v1-5-pruned-emaonly.safetensors',
        'realistic-vision-inpaint.safetensors',
        'sd-v1-5-inpainting.safetensors',
        'svd.safetensors',
        'svd_xt.safetensors'
    ];

    for (const name of Object.keys(nameGroups)) {
        const group = nameGroups[name];
        if (group.length > 1) {
            console.log(`Duplicates for "${name}":`, group.map(m => m.file_path));
        }
    }

    // Instead of complex logic, if the user wants only what's in comfyui:
    // Any model where file_path is NOT in validFiles should be deleted?
    // OR just keep one of each name if it's in validFiles.

    for (const model of models) {
        if (!validFiles.includes(model.file_path)) {
            console.log(`Flagging for deletion (not in ComfyUI): ${model.name} (${model.file_path})`);
            idsToDelete.push(model.id);
        }
    }

    // Also handle name duplicates within validFiles
    for (const name of Object.keys(nameGroups)) {
        const group = nameGroups[name].filter(m => validFiles.includes(m.file_path));
        if (group.length > 1) {
            // Keep only the first one
            for (let i = 1; i < group.length; i++) {
                console.log(`Flagging for deletion (duplicate name): ${group[i].name} (${group[i].file_path})`);
                idsToDelete.push(group[i].id);
            }
        }
    }

    if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} models...`);
        const { error: deleteError } = await (supabaseAdmin.from('models') as any).delete().in('id', idsToDelete);
        if (deleteError) {
            console.error('Delete error:', deleteError);
        } else {
            console.log('Successfully cleaned up models.');
        }
    } else {
        console.log('No models to delete.');
    }
}

cleanupModels();
