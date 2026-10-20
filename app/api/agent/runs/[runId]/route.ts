import { getAuthenticatedSupabase } from "../../../../../lib/agent-auth";

export async function PATCH(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  const { runId } = await context.params;
  const { data, error } = await authenticated.supabase.rpc("request_agent_run_cancellation", { p_run_id: runId });
  if (error) return Response.json({ error: error.message.includes("not found") ? "Run not found" : "Cancellation could not be requested" }, { status: error.message.includes("not found") ? 404 : 503 });
  return Response.json({ status: data });
}