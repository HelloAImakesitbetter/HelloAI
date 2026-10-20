import { getAuthenticatedSupabase } from "../../../../../lib/agent-auth";

export async function DELETE(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  const { runId } = await context.params;
  const { data, error } = await authenticated.supabase
    .from("agent_runs")
    .delete()
    .eq("id", runId)
    .eq("user_id", authenticated.userId)
    .in("status", ["planned", "completed", "failed", "cancelled"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Agent run deletion failed:", error);
    return Response.json({ error: "The saved plan could not be deleted" }, { status: 503 });
  }
  if (data) return Response.json({ deleted: true });

  const { data: existingRun, error: lookupError } = await authenticated.supabase
    .from("agent_runs")
    .select("status")
    .eq("id", runId)
    .eq("user_id", authenticated.userId)
    .maybeSingle();
  if (lookupError) return Response.json({ error: "The saved plan could not be checked" }, { status: 503 });
  if (!existingRun) return Response.json({ error: "Saved plan not found" }, { status: 404 });
  return Response.json({ error: "Cancel the active run and wait for it to stop before deleting it" }, { status: 409 });
}

export async function PATCH(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  const { runId } = await context.params;
  const { data, error } = await authenticated.supabase.rpc("request_agent_run_cancellation", { p_run_id: runId });
  if (error) return Response.json({ error: error.message.includes("not found") ? "Run not found" : "Cancellation could not be requested" }, { status: error.message.includes("not found") ? 404 : 503 });
  return Response.json({ status: data });
}