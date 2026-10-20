import { inngest } from "../../../../../../lib/inngest";
import { getAuthenticatedSupabase } from "../../../../../../lib/agent-auth";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  if (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Background execution is not configured. Set the Inngest event/signing keys and server-side Supabase worker key." }, { status: 503 });
  }

  const { runId } = await context.params;
  const { data: run, error: loadError } = await authenticated.supabase
    .from("agent_runs")
    .select("id, status, cancel_requested")
    .eq("id", runId)
    .eq("user_id", authenticated.userId)
    .maybeSingle();
  if (loadError || !run) return Response.json({ error: "Run not found" }, { status: 404 });
  if (run.cancel_requested || !["planned", "queued"].includes(run.status)) {
    return Response.json({ error: `This run cannot be started while it is ${run.status}` }, { status: 409 });
  }

  const { data: tasks, error: taskError } = await authenticated.supabase
    .from("agent_tasks")
    .select("tool_name, tool_input, status")
    .eq("run_id", runId)
    .eq("user_id", authenticated.userId);
  if (taskError || !tasks?.length || tasks.length !== 1 || tasks.some((task) => task.tool_name !== "website.generate" || !task.tool_input.description)) {
    return Response.json({ error: "This run is not a valid website-generation task" }, { status: 409 });
  }

  if (run.status === "planned") {
    const { error: queueError } = await authenticated.supabase.rpc("queue_agent_run", { p_run_id: runId });
    if (queueError) return Response.json({ error: "The task plan could not be queued" }, { status: 409 });
  }

  try {
    const sent = await inngest.send({ name: "helloai/agent.run.requested", data: { runId, userId: authenticated.userId } });
    return Response.json({ status: "queued", eventId: sent.ids[0] || null });
  } catch (error) {
    console.error("Could not enqueue agent run:", error);
    return Response.json({ error: "The task is queued, but the background service did not accept it. Retry Start to dispatch it." }, { status: 503 });
  }
}