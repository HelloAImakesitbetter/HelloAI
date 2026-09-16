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

    if (task.status !== "SUCCEEDED" || !task.output[0]) {
      throw new Error("Runway video is not ready");
    }

    const content = await fetch(task.output[0]);

    if (!content.ok) {
      throw new Error("Runway video download failed");
    }

    return new Response(await content.arrayBuffer(), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=ai-business-video.mp4",
      },
    });
  } catch (error) {
    console.error("AI video download failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download AI video",
      },
      { status: 500 }
    );
  }
}
