import RunwayML from "@runwayml/sdk";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const searchParams = new URL(req.url).searchParams;
    const provider = searchParams.get("provider") || "runway";
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (provider === "heygen") {
      const heygenKey = process.env.HEYGEN_API_KEY;
      if (!heygenKey) throw new Error("HEYGEN_API_KEY is not configured");
      if (!ids.length) return Response.json({ error: "A HeyGen video ID is required" }, { status: 400 });

      const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(ids[0])}`, {
        headers: { "X-Api-Key": heygenKey },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || data?.message || "Failed to check HeyGen status");
      const status = data?.data?.status;
      return Response.json({
        status: status === "completed" ? "completed" : status === "failed" ? "failed" : "in_progress",
        progress: status === "completed" ? 100 : 0,
        error: data?.data?.error || null,
      });
    }

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
