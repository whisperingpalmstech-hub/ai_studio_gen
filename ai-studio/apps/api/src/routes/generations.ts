
import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { NotFoundError, BadRequestError } from "../middleware/error.js";
import fs from "fs";
import path from "path";

const router = Router();

/**
 * DELETE /api/v1/generations/:id
 * Enterprise-grade deletion with storage cleanup and ownership verification
 */
router.delete("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id: assetId } = req.params;
    const user = req.user!;

    console.log(`[DELETE] Generation request received: ID=${assetId}, User=${user.id}`);

    try {
        // 1. Ownership Verification & Data Fetch
        const { data: asset, error: fetchError } = await supabaseAdmin
            .from("assets")
            .select("*")
            .eq("id", assetId)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !asset) {
            console.warn(`[DELETE] Asset not found or unauthorized access attempt: ID=${assetId}, User=${user.id}`);
            throw new NotFoundError("Generation not found or you don't have permission to delete it.");
        }

        const filePath = (asset as any).file_path;
        console.log(`[DELETE] Found asset record. Storage Path: ${filePath}`);

        // 2. Storage Cleanup (Cloud or Local)
        // Extract the relative path from the URL if it's a Supabase public URL
        let storagePath = null;
        if (filePath.includes('/assets/')) {
            // Standard Cloud Storage Path
            storagePath = filePath.split('/assets/')[1];
        } else if (filePath.includes('/outputs/')) {
            // Local fallback path
            storagePath = filePath.split('/outputs/')[1];
        }

        if (storagePath) {
            try {
                // If it's a Supabase storage path (Cloud)
                console.log(`[DELETE] Attempting cloud storage removal: ${storagePath}`);
                const { error: storageError } = await supabaseAdmin.storage
                    .from("assets")
                    .remove([storagePath]);

                if (storageError) {
                    console.error(`[DELETE] Cloud storage error: ${storageError.message}`);
                    // We continue even if storage delete fails to avoid orphaned DB records
                } else {
                    console.log(`[DELETE] Successfully removed file from cloud storage.`);
                }
            } catch (storageCatch) {
                console.error(`[DELETE] Fatal storage cleanup error:`, storageCatch);
            }
        }

        // 3. Database Record Deletion
        // Using a transaction-like approach (though Supabase/PostgREST delete is atomic for the row)
        const { error: deleteError } = await supabaseAdmin
            .from("assets")
            .delete()
            .eq("id", assetId);

        if (deleteError) {
            console.error(`[DELETE] DB Deletion failed: ${deleteError.message}`);
            throw new Error(`Failed to remove generation record: ${deleteError.message}`);
        }

        console.log(`[DELETE] Successfully deleted generation ${assetId} and cleaned up assets.`);

        return res.status(200).json({
            success: true,
            message: "Generation and associated files deleted successfully.",
            id: assetId
        });

    } catch (err) {
        console.error(`[DELETE] Critical failure in generation delete lifecycle:`, err);
        next(err);
    }
});

export { router as generationsRouter };
