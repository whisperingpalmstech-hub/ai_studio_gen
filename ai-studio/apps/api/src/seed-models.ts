import { supabaseAdmin } from './services/supabase.js';

export async function seedModels() {
    const models = [
        {
            name: 'Wan 2.1 I2V 14B',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'wan2.1_i2v_720p_14B_bf16.safetensors',
            description: 'Native Wan 2.1 Image-to-Video Model (14B)',
            is_system: true,
            is_public: true,
            metadata: { provider: 'wan', version: '2.1' }
        },
        {
            name: 'Wan 2.1 T2V 1.3B',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'wan2.1_t2v_1.3B_bf16.safetensors',
            description: 'Native Wan 2.1 Text-to-Video Model (1.3B)',
            is_system: true,
            is_public: true,
            metadata: { provider: 'wan', version: '2.1' }
        },
        {
            name: 'Wan 2.1 VAE',
            type: 'vae' as const,
            base_model: 'other' as const,
            file_path: 'wan_2.1_vae.safetensors',
            description: 'Native Wan 2.1 VAE',
            is_system: true,
            is_public: true,
            metadata: { provider: 'wan' }
        },
        {
            name: 'T5 XXL Encoder',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
            description: 'Text Encoder for Wan 2.1',
            is_system: true,
            is_public: true,
            metadata: { provider: 'google' }
        },
        {
            name: 'CLIP Vision H',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'clip_vision_h.safetensors',
            description: 'CLIP Vision model for Wan 2.1',
            is_system: true,
            is_public: true,
            metadata: { provider: 'openai' }
        },
        {
            name: 'Stable Diffusion XL',
            type: 'checkpoint' as const,
            base_model: 'sdxl' as const,
            file_path: 'sd_xl_base_1.0.safetensors',
            description: 'Stable Diffusion XL Base 1.0',
            is_system: true,
            is_public: true,
            metadata: { provider: 'stabilityai' }
        },
        {
            name: 'Stable Diffusion 1.5',
            type: 'checkpoint' as const,
            base_model: 'sd15' as const,
            file_path: 'v1-5-pruned-emaonly.safetensors',
            description: 'Standard SD 1.5 model',
            is_system: true,
            is_public: true,
            metadata: { provider: 'runwayml' }
        },
        {
            name: 'Realistic Vision Inpaint',
            type: 'checkpoint' as const,
            base_model: 'sd15' as const,
            file_path: 'realistic-vision-inpaint.safetensors',
            description: 'Inpainting version of Realistic Vision',
            is_system: true,
            is_public: true,
            metadata: { provider: 'community' }
        },
        {
            name: 'SD 1.5 Inpainting',
            type: 'checkpoint' as const,
            base_model: 'sd15' as const,
            file_path: 'sd-v1-5-inpainting.safetensors',
            description: 'Standard SD 1.5 Inpainting model',
            is_system: true,
            is_public: true,
            metadata: { provider: 'runwayml' }
        },
        {
            name: 'SVD',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'svd.safetensors',
            description: 'Stable Video Diffusion Base',
            is_system: true,
            is_public: true,
            metadata: { provider: 'stabilityai' }
        },
        {
            name: 'SVD XT',
            type: 'checkpoint' as const,
            base_model: 'other' as const,
            file_path: 'svd_xt.safetensors',
            description: 'Stable Video Diffusion XT',
            is_system: true,
            is_public: true,
            metadata: { provider: 'stabilityai' }
        }
    ];

    const validFiles = models.map(m => m.file_path);

    // 1. Delete models that are NOT in our valid list (only if they are system/public models)
    const { error: cleanupError } = await (supabaseAdmin
        .from('models') as any)
        .delete()
        .not('file_path', 'in', `(${validFiles.join(',')})`)
        .eq('is_system', true);

    if (cleanupError) {
        console.error('Error during models cleanup:', cleanupError);
    }

    // 2. Process our standard set
    for (const modelData of models) {
        // Find existing model by file_path
        const { data: existingModels } = await (supabaseAdmin
            .from('models') as any)
            .select('id')
            .eq('file_path', modelData.file_path);

        if (existingModels && existingModels.length > 0) {
            // Keep the first one and update it
            const firstId = existingModels[0].id;
            await (supabaseAdmin.from('models') as any).update(modelData).eq('id', firstId);

            // Delete any others with the same file_path
            if (existingModels.length > 1) {
                const otherIds = existingModels.slice(1).map((m: any) => m.id);
                await (supabaseAdmin.from('models') as any).delete().in('id', otherIds);
            }
        } else {
            // Insert new
            await (supabaseAdmin.from('models') as any).insert(modelData);
        }
    }

    // 3. Final duplicate check by name (if paths differ but names match)
    const { data: allModels } = await (supabaseAdmin.from('models') as any).select('id, name').eq('is_system', true);
    if (allModels) {
        const nameMap: Record<string, string[]> = {};
        allModels.forEach((m: any) => {
            if (!nameMap[m.name]) nameMap[m.name] = [];
            nameMap[m.name].push(m.id);
        });

        for (const name of Object.keys(nameMap)) {
            const ids = nameMap[name];
            if (ids.length > 1) {
                // Keep the first one found
                const idsToDelete = ids.slice(1);
                await (supabaseAdmin.from('models') as any).delete().in('id', idsToDelete);
                console.log(`Cleaned up ${idsToDelete.length} duplicates for model name: ${name}`);
            }
        }
    }

    console.log('✅ Models table synchronized with ComfyUI storage');
}
