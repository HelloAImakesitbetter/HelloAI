import { createClient } from "@supabase/supabase-js";

export async function getAuthenticatedSupabase(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 8192) {
    return { error: Response.json({ error: "A valid sign-in session is required" }, { status: 401 }) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: Response.json({ error: "Authentication is not configured" }, { status: 503 }) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: Response.json({ error: "Your sign-in session is invalid or expired" }, { status: 401 }) };
  }

  return { supabase, userId: data.user.id };
}