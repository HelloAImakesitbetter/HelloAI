import { createClient } from "@supabase/supabase-js";
import { inngest } from "./inngest";
import { generateWebsiteDraft, type WebsiteGenerationInput } from "./website-generator";

type StartEvent = {
  data: {
    runId: string;
    userId: string;
  };
};

type TaskRecord = {
  task_key: string;
  title: string;
  description: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  status: string;
  position: number;
  attempts: number;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Server-side Supabase worker credentials are not configured");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function summarizeDraft(draft: Awaited<ReturnType<typeof generateWebsiteDraft>>) {
  return {
    pageCount: draft.pages.length,
    pages: draft.pages.map((page) => ({ slug: page.slug, label: page.label, title: page.title })),
  };
}

export const executeAgentRun = inngest.createFunction(
  {
    id: "execute-agent-run",
    retries: 0,
    concurrency: { limit: 3, key: "event.data.userId" },
    idempotency: "event.data.runId",
    triggers: [{ event: "helloai/agent.run.requested" }],
  },
  async ({ event, step }) => {
    const { runId, userId } = event.data as unknown as StartEvent["data"];
    const admin = getAdminClient();

    try {
    const initial = await step.run("load-and-claim-run", async () => {
      const { data: run, error: runError } = await admin
        .from("agent_runs")
        .select("id, user_id, status, cancel_requested, max_tool_calls")
        .eq("id", runId)
        .eq("user_id", userId)
        .maybeSingle();
      if (runError || !run) throw new Error("Agent run was not found for this owner");
      if (run.cancel_requested || run.status === "cancelled") {
        await admin.from("agent_runs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", runId).eq("user_id", userId);
        await admin.from("agent_tasks").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("run_id", runId).eq("user_id", userId).in("status", ["pending", "ready"]);
        return { cancelled: true as const, maxToolCalls: 0 };
      }
      if (run.status !== "queued" && run.status !== "running") throw new Error(`Run cannot execute from status ${run.status}`);

      const { error: updateError } = await admin
        .from("agent_runs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", runId)
        .eq("user_id", userId)
        .eq("status", "queued");
      if (updateError) throw updateError;

      const { data: tasks, error: tasksError } = await admin
        .from("agent_tasks")
        .select("task_key, title, description, tool_name, tool_input, status, position, attempts")
        .eq("run_id", runId)
        .eq("user_id", userId)
        .order("position");
      if (tasksError || !tasks?.length) throw new Error("Agent run has no tasks");
      if (tasks.length > run.max_tool_calls) throw new Error("Agent run exceeds its tool-call budget");
      if (tasks.some((task) => task.tool_name !== "website.generate")) throw new Error("Agent run includes a tool that is not enabled in this worker");
      return { cancelled: false as const, maxToolCalls: run.max_tool_calls, tasks: tasks as TaskRecord[] };
    });

    if (initial.cancelled) return { status: "cancelled", runId };

    for (const task of initial.tasks) {
      const outcome = await step.run(`task-${task.task_key}`, async () => {
        const { data: run, error: runError } = await admin
          .from("agent_runs")
          .select("cancel_requested, status")
          .eq("id", runId)
          .eq("user_id", userId)
          .maybeSingle();
        if (runError || !run) throw new Error("Agent run disappeared during execution");
        if (run.cancel_requested || run.status === "cancelled") return { cancelled: true as const };

        const { data: dependencies, error: dependencyError } = await admin
          .from("agent_task_dependencies")
          .select("depends_on_task_key")
          .eq("run_id", runId)
          .eq("user_id", userId)
          .eq("task_key", task.task_key);
        if (dependencyError) throw dependencyError;
        const dependenciesKeys = (dependencies || []).map((dependency) => dependency.depends_on_task_key);
        if (dependenciesKeys.length) {
          const { data: dependencyTasks, error: dependencyTaskError } = await admin
            .from("agent_tasks")
            .select("task_key, status")
            .eq("run_id", runId)
            .eq("user_id", userId)
            .in("task_key", dependenciesKeys);
          if (dependencyTaskError) throw dependencyTaskError;
          if ((dependencyTasks || []).length !== dependenciesKeys.length || dependencyTasks?.some((dependencyTask) => dependencyTask.status !== "completed")) {
            throw new Error(`Task ${task.task_key} has incomplete dependencies`);
          }
        }

        if (task.status === "completed") return { cancelled: false as const, alreadyCompleted: true as const, result: null, summary: null };
        if (task.status !== "ready" && task.status !== "running") throw new Error(`Task ${task.task_key} is not ready`);

        const attempt = task.attempts + 1;
        if (attempt > 3) throw new Error(`Task ${task.task_key} exceeded its retry limit`);
        const startedAt = new Date().toISOString();
        const { error: auditError } = await admin.from("agent_tool_calls").insert({
          run_id: runId,
          user_id: userId,
          task_key: task.task_key,
          attempt,
          tool_name: task.tool_name,
          input: task.tool_input,
          status: "running",
          started_at: startedAt,
        });
        if (auditError) throw auditError;

        const { error: markError } = await admin
          .from("agent_tasks")
          .update({ status: "running", attempts: attempt, started_at: startedAt, updated_at: startedAt })
          .eq("run_id", runId)
          .eq("user_id", userId)
          .eq("task_key", task.task_key)
          .in("status", ["ready", "running"]);
        if (markError) throw markError;

        try {
          const result = await generateWebsiteDraft(task.tool_input as unknown as WebsiteGenerationInput);
          if (result.pages.length < 6) throw new Error("Website draft verification failed: at least six pages are required");

          const summary = summarizeDraft(result);
          const evidence = { pageCount: result.pages.length, hasHomePage: result.pages.some((page) => page.slug === "home"), generatedAt: new Date().toISOString() };
          if (!evidence.hasHomePage) throw new Error("Website draft verification failed: a home page is missing");

          const finishedAt = new Date().toISOString();
          const { error: completeTaskError } = await admin
            .from("agent_tasks")
            .update({ status: "completed", result, evidence, error_message: null, completed_at: finishedAt, updated_at: finishedAt })
            .eq("run_id", runId)
            .eq("user_id", userId)
            .eq("task_key", task.task_key);
          if (completeTaskError) throw completeTaskError;

          const { error: completeCallError } = await admin
            .from("agent_tool_calls")
            .update({ status: "completed", output_summary: summary, evidence, finished_at: finishedAt })
            .eq("run_id", runId)
            .eq("task_key", task.task_key)
            .eq("attempt", attempt);
          if (completeCallError) throw completeCallError;
          return { cancelled: false as const, alreadyCompleted: false as const, result, summary };
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 1000) : "Website generation failed";
          const failedAt = new Date().toISOString();
          await Promise.all([
            admin.from("agent_tasks").update({ status: "failed", error_message: message, updated_at: failedAt }).eq("run_id", runId).eq("user_id", userId).eq("task_key", task.task_key),
            admin.from("agent_tool_calls").update({ status: "failed", error_message: message, finished_at: failedAt }).eq("run_id", runId).eq("task_key", task.task_key).eq("attempt", attempt),
            admin.from("agent_runs").update({ status: "failed", updated_at: failedAt }).eq("id", runId).eq("user_id", userId),
          ]);
          throw error;
        }
      });

      if (outcome.cancelled) {
        await step.run(`mark-cancelled-${task.task_key}`, async () => {
          await admin.from("agent_tasks").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("run_id", runId).eq("user_id", userId).eq("task_key", task.task_key).in("status", ["ready", "pending"]);
          await admin.from("agent_runs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", runId).eq("user_id", userId);
        });
        return { status: "cancelled", runId };
      }
    }

    return await step.run("verify-and-finish-run", async () => {
      const { data: run, error: runError } = await admin.from("agent_runs").select("cancel_requested").eq("id", runId).eq("user_id", userId).maybeSingle();
      if (runError || !run) throw new Error("Could not verify agent run state");
      const { data: tasks, error: taskError } = await admin
        .from("agent_tasks")
        .select("task_key, status, result, evidence")
        .eq("run_id", runId)
        .eq("user_id", userId);
      if (taskError || !tasks?.length) throw new Error("Could not verify agent task results");
      if (tasks.some((task) => task.status !== "completed" || !task.result || !task.evidence)) throw new Error("Agent run has tasks without verified results");

      const completedAt = new Date().toISOString();
      const terminalStatus = run.cancel_requested ? "cancelled" : "completed";
      const { error: updateError } = await admin.from("agent_runs").update({ status: terminalStatus, updated_at: completedAt }).eq("id", runId).eq("user_id", userId);
      if (updateError) throw updateError;
      return { status: terminalStatus, runId, verifiedTasks: tasks.length };
    });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Agent execution failed";
      await Promise.all([
        admin.from("agent_runs").update({ status: "failed", updated_at: failedAt }).eq("id", runId).eq("user_id", userId).in("status", ["queued", "running"]),
        admin.from("agent_tasks").update({ status: "failed", error_message: message, updated_at: failedAt }).eq("run_id", runId).eq("user_id", userId).in("status", ["pending", "ready", "running"]),
        admin.from("agent_tool_calls").update({ status: "failed", error_message: message, finished_at: failedAt }).eq("run_id", runId).eq("user_id", userId).eq("status", "running"),
      ]);
      throw error;
    }
  }
);
