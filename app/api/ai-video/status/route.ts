import RunwayML from "@runwayml/sdk";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const id = new URL(req.url).searchParams.get("id");

    if (!apiKey) {
      throw new Error("RUNWAYML_API_SECRET is not configured");
    }

    if (!id) {
      return Response.json({ error: "A video ID is required" }, { status: 400 });
    }

    const runway = new RunwayML({ apiKey });
    const task = await runway.tasks.retrieve(id);
    const status = task.status.toLowerCase();

    return Response.json({
      id: task.id,
      status: status === "succeeded" ? "completed" : status === "failed" ? "failed" : "in_progress",
      progress: status === "succeeded" ? 100 : 0,
      error: task.status === "FAILED" ? task.failure : null,
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
