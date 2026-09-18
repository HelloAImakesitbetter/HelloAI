import RunwayML from "@runwayml/sdk";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured");
    if (!ids.length) return Response.json({ error: "A Runway task ID is required" }, { status: 400 });

    const client = new RunwayML({ apiKey });
    const tasks = await Promise.all(ids.map((id) => client.tasks.retrieve(id)));
    const failed = tasks.find((task) => task.status === "FAILED");
    const completed = tasks.filter((task) => task.status === "SUCCEEDED").length;
    return Response.json({ status: failed ? "failed" : completed === tasks.length ? "completed" : "in_progress", progress: Math.round((completed / tasks.length) * 100), error: failed?.failure || null });
  } catch (error) {
    console.error("Runway status failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to check Runway status" }, { status: 500 });
  }
}
