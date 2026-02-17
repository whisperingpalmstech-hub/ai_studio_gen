import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

// GET — list user's API keys
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await (supabase.from("api_keys") as any)
        .select("id, name, key_prefix, is_active, last_used_at, expires_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ keys: data || [] });
}

// POST — generate a new API key
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Default";

    // Limit to 5 keys per user
    const { count } = await (supabase.from("api_keys") as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

    if ((count || 0) >= 5) {
        return NextResponse.json({ error: "Maximum 5 API keys allowed. Delete an existing key first." }, { status: 400 });
    }

    // Generate key: aisk_ + 40 hex chars
    const rawKey = `aisk_${randomBytes(20).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 12); // e.g. "aisk_abc1de2f"

    const { error } = await (supabase.from("api_keys") as any).insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the full key ONCE — it cannot be retrieved again
    return NextResponse.json({
        key: rawKey,
        prefix: keyPrefix,
        message: "Save this key now. It will not be shown again.",
    });
}

// DELETE — revoke an API key
export async function DELETE(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "Missing key id" }, { status: 400 });

    const { error } = await (supabase.from("api_keys") as any)
        .delete()
        .eq("id", keyId)
        .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
