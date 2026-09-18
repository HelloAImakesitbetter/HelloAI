export async function GET(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) || [];

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (ids.length === 0) return Response.json({ error: "A HeyGen session ID is required" }, { status: 400 });

    const videoResponse = await fetch(`https://api.heygen.com/v3/videos/${encodeURIComponent(ids[0])}`, { headers: { "X-Api-Key": apiKey } });
    const videoData = await videoResponse.json();
    if (!videoResponse.ok) throw new Error(videoData?.error?.message || "HeyGen video status failed");

    const video = videoData?.data;
    return Response.json({
      status: video?.status === "completed" ? "completed" : video?.status === "failed" ? "failed" : "in_progress",
      progress: video?.status === "completed" ? 100 : 50,
      error: video?.failure_message || video?.error?.message || null,
    });
  } catch (error) {
    console.error("HeyGen video status failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to check HeyGen video status" }, { status: 500 });
  }
}
