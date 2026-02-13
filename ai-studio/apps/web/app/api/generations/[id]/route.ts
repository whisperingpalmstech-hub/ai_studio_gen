
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Initialize Supabase Admin (Server-side only)
// Note: SUPABASE_SERVICE_ROLE_KEY must be set in your environment variables (e.g. Vercel Environment Variables)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Fallback to anon if admin key missing (will respect RLS)
);

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const assetId = params.id;

        // 1. Verify Authentication & Ownership
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch asset to get file path and verify ownership
        const { data: asset, error: fetchError } = await supabaseAdmin
            .from("assets")
            .select("*")
            .eq("id", assetId)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !asset) {
            console.error("[API] Asset not found or unauthorized:", fetchError);
            return NextResponse.json({ error: "Asset not found or unauthorized" }, { status: 404 });
        }

        // 3. Storage Cleanup
        const filePath = asset.file_path;
        if (filePath && filePath.includes("/assets/")) {
            const storagePath = filePath.split("/assets/")[1];
            console.log(`[API] Cleaning up storage: ${storagePath}`);

            const { error: storageError } = await supabaseAdmin.storage
                .from("assets")
                .remove([storagePath]);

            if (storageError) {
                console.warn("[API] Storage cleanup warning:", storageError.message);
                // We proceed to DB deletion even if storage fails
            }
        }

        // 4. Database Deletion
        const { error: deleteError } = await supabaseAdmin
            .from("assets")
            .delete()
            .eq("id", assetId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true, message: "Asset deleted successfully" });

    } catch (error: any) {
        console.error("[API] Critical deletion error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete asset" },
            { status: 500 }
        );
    }
}
