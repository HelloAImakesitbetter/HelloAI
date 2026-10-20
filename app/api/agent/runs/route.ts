import OpenAI from "openai";
import { getAuthenticatedSupabase } from "../../../../lib/agent-auth";
import type { WebsiteGenerationInput } from "../../../../lib/website-generator";

const availableTools = ["website.generate"] as const;

type ToolName = (typeof availableTools)[number];
type PlannedTask = {
  key: string;
  title: string;
  description: string;
  toolName: ToolName;
  toolInput: WebsiteGenerationInput;
  dependsOn: string[];
  requiresApproval: boolean;
};

export async function GET(request: Request) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  const { data: runs, error: runsError } = await authenticated.supabase
    .from("agent_runs")
    .select("id, goal, status, success_criteria, plan, cancel_requested, created_at, updated_at")
    .eq("user_id", authenticated.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (runsError) return Response.json({ error: "Agent run history could not be loaded" }, { status: 503 });
  if (!runs?.length) return Response.json({ runs: [] });

  const runIds = runs.map((run) => run.id);
  const [{ data: tasks, error: tasksError }, { data: dependencies, error: dependenciesError }] = await Promise.all([
    authenticated.supabase
      .from("agent_tasks")
      .select("run_id, task_key, title, description, tool_name, tool_input, requires_approval, status, position, result, evidence, error_message, attempts, started_at, completed_at")
      .eq("user_id", authenticated.userId)
      .in("run_id", runIds)
      .order("position"),
    authenticated.supabase
      .from("agent_task_dependencies")
      .select("run_id, task_key, depends_on_task_key")
      .eq("user_id", authenticated.userId)
      .in("run_id", runIds),
  ]);

  if (tasksError || dependenciesError) return Response.json({ error: "Agent task history could not be loaded" }, { status: 503 });

  return Response.json({ runs: runs.map((run) => ({
    id: run.id,
    goal: run.goal,
    status: run.status,
    successCriteria: run.success_criteria,
    cancelRequested: run.cancel_requested,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    tasks: (tasks || []).filter((task) => task.run_id === run.id).map((task) => ({
      key: task.task_key,
      title: task.title,
      description: task.description,
      toolName: task.tool_name,
      toolInput: task.tool_input,
      requiresApproval: task.requires_approval,
      status: task.status,
      position: task.position,
      result: task.result,
      evidence: task.evidence,
      errorMessage: task.error_message,
      attempts: task.attempts,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      dependsOn: (dependencies || []).filter((dependency) => dependency.run_id === run.id && dependency.task_key === task.task_key).map((dependency) => dependency.depends_on_task_key),
    })),
  })) });
}

function parsePlan(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The planner returned invalid JSON");

  const value = JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  if (value.supported === false) {
    const reason = typeof value.reason === "string" ? value.reason.trim().slice(0, 300) : "Only website draft generation is currently executable.";
    return { supported: false as const, reason };
  }
  if (value.supported !== true) throw new Error("The planner did not confirm that this goal is supported");
  if (!Array.isArray(value.tasks) || value.tasks.length !== 1) {
    throw new Error("The planner must return exactly one website-generation task for this execution slice");
  }

  const tasks = value.tasks.map((rawTask, position): PlannedTask & { position: number } => {
    if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) throw new Error("The planner returned an invalid task");
    const task = rawTask as Record<string, unknown>;
    const key = "website-draft";
    const title = typeof task.title === "string" ? task.title.trim() : "";
    const description = typeof task.description === "string" ? task.description.trim() : "";
    const toolName = task.toolName;
    if (!title || title.length > 200 || !description || description.length > 2000) throw new Error("The planner returned incomplete task details");
    if (typeof toolName !== "string" || !availableTools.includes(toolName as ToolName)) throw new Error("The planner selected a tool that is not enabled");
    if (!Array.isArray(task.dependsOn) || task.dependsOn.length > 7 || !task.dependsOn.every((dependency) => typeof dependency === "string")) {
      throw new Error("The planner returned invalid task dependencies");
    }
    if (!task.toolInput || typeof task.toolInput !== "object" || Array.isArray(task.toolInput)) throw new Error("The planner returned invalid tool inputs");
    const rawInput = task.toolInput as Record<string, unknown>;
    const inputText = (field: string, maximum: number, required = false) => {
      const item = rawInput[field];
      if (item === undefined && !required) return undefined;
      if (typeof item !== "string" || (required && !item.trim()) || item.length > maximum) throw new Error(`The planner returned invalid ${field}`);
      return item.trim();
    };
    const toolInput: WebsiteGenerationInput = {
      businessName: inputText("businessName", 160),
      description: inputText("description", 4000, true) as string,
      industry: inputText("industry", 120),
      location: inputText("location", 160),
      phone: inputText("phone", 80),
      email: inputText("email", 254),
      websiteUrl: inputText("websiteUrl", 2048),
      services: inputText("services", 1000),
      audience: inputText("audience", 500),
      tone: inputText("tone", 120),
      primaryAction: inputText("primaryAction", 200),
    };
    if (toolInput.websiteUrl) {
      try {
        const websiteUrl = new URL(toolInput.websiteUrl);
        if (!/^https?:$/.test(websiteUrl.protocol)) throw new Error();
      } catch {
        throw new Error("The planner returned an invalid website URL");
      }
    }

    return {
      key,
      title,
      description,
      toolName: toolName as ToolName,
      toolInput,
      dependsOn: task.dependsOn as string[],
      requiresApproval: toolName === "wordpress.create_draft",
      position,
    };
  });

  const priorKeys = new Set<string>();
  for (const task of tasks) {
    if (new Set(task.dependsOn).size !== task.dependsOn.length || task.dependsOn.some((dependency) => !priorKeys.has(dependency))) {
      throw new Error("Task dependencies must refer to a unique earlier task");
    }
    priorKeys.add(task.key);
  }

  const rawCriteria = value.successCriteria;
  if (!Array.isArray(rawCriteria) || rawCriteria.length < 1 || rawCriteria.length > 6 || !rawCriteria.every((criterion) => typeof criterion === "string" && criterion.trim().length > 0 && criterion.length <= 240)) {
    throw new Error("The planner returned invalid success criteria");
  }

  return {
    supported: true as const,
    tasks,
    successCriteria: rawCriteria.map((criterion) => (criterion as string).trim()),
  };
}

export async function POST(request: Request) {
  const authenticated = await getAuthenticatedSupabase(request);
  if ("error" in authenticated) return authenticated.error;

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_000) return Response.json({ error: "Request body is too large" }, { status: 413 });
    const bodyText = await request.text();
    if (bodyText.length > 16_000) return Response.json({ error: "Request body is too large" }, { status: 413 });

    const body = JSON.parse(bodyText) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const requestBody = body as Record<string, unknown>;
    const goal = typeof requestBody.goal === "string" ? requestBody.goal.trim() : "";
    if (!goal || goal.length > 4000) return Response.json({ error: "A goal between 1 and 4000 characters is required" }, { status: 400 });
    const requestedCriteria = requestBody.successCriteria;
    if (requestedCriteria !== undefined && (!Array.isArray(requestedCriteria) || requestedCriteria.length > 6 || !requestedCriteria.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 240))) {
      return Response.json({ error: "Success criteria must be up to 6 non-empty strings of 240 characters or fewer" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "AI planning is not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Decide whether the goal can be accomplished by generating one small-business website draft. Return JSON only. If it cannot, return {"supported":false,"reason":"A brief explanation that website draft generation does not fulfill this goal."}. If it can, return {"supported":true,"successCriteria":[1-6 strings],"tasks":[one object with key,title,description,toolName,toolInput,dependsOn]}. Set key to exactly "website-draft". The only allowed toolName is website.generate. toolInput must contain description and may include businessName, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction. Use user-provided information; do not invent contact details or claim the draft already exists. Use an empty dependsOn array.\n\nUser goal:\n${goal}\n\nUser-provided success criteria:\n${JSON.stringify(requestBody.successCriteria || [])}`,
    });

    const plan = parsePlan(response.output_text);
    if (!plan.supported) return Response.json({ error: plan.reason }, { status: 422 });
    const { data: runId, error } = await authenticated.supabase.rpc("create_agent_plan", {
      p_goal: goal,
      p_success_criteria: plan.successCriteria,
      p_plan: plan.tasks,
      p_tasks: plan.tasks.map((task) => ({
        task_key: task.key,
        title: task.title,
        description: task.description,
        tool_name: task.toolName,
        tool_input: task.toolInput,
        depends_on: task.dependsOn,
        requires_approval: task.requiresApproval,
        position: task.position,
      })),
    });
    if (error || typeof runId !== "string") {
      console.error("Agent plan persistence failed:", error);
      return Response.json({ error: "The plan could not be saved. Apply the agent plan database migration and try again." }, { status: 503 });
    }

    return Response.json({
      run: {
        id: runId,
        status: "planned",
        goal,
        successCriteria: plan.successCriteria,
        tasks: plan.tasks,
      },
      executionStarted: false,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    console.error("Agent planning failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to plan task" }, { status: 502 });
  }
}