import RunwayML from "@runwayml/sdk";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) || [];

    if (!apiKey) {
      throw new Error("RUNWAYML_API_SECRET is not configured");
    }

    if (ids.length === 0) {
      return Response.json({ error: "Video IDs are required" }, { status: 400 });
    }

    const runway = new RunwayML({ apiKey });
    const tasks = await Promise.all(ids.map((id) => runway.tasks.retrieve(id)));
    const failedTask = tasks.find((task) => task.status === "FAILED");
    const completedCount = tasks.filter((task) => task.status === "SUCCEEDED").length;

    return Response.json({
      status: failedTask ? "failed" : completedCount === tasks.length ? "completed" : "in_progress",
      progress: Math.round((completedCount / tasks.length) * 100),
      error: failedTask?.failure || null,
    });
  } catch (error) {
    console.error("AI video status failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check AI video status",
      },
      { status: 500 }
    );
  }
}
