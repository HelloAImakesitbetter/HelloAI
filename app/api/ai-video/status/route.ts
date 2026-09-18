export async function GET(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) || [];

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (ids.length === 0) return Response.json({ error: "A HeyGen session ID is required" }, { status: 400 });

    const videos = await Promise.all(ids.map(async (id) => {
      const videoResponse = await fetch(`https://api.heygen.com/v3/videos/${encodeURIComponent(id)}`, { headers: { "X-Api-Key": apiKey } });
      const videoData = await videoResponse.json();
      if (!videoResponse.ok) throw new Error(videoData?.error?.message || "HeyGen video status failed");
      return videoData?.data;
    }));
    const failed = videos.find((video) => video?.status === "failed");
    const completed = videos.filter((video) => video?.status === "completed").length;
    return Response.json({
      status: failed ? "failed" : completed === videos.length ? "completed" : "in_progress",
      progress: Math.round((completed / videos.length) * 100),
      error: failed?.failure_message || failed?.error?.message || null,
    });
  } catch (error) {
    console.error("HeyGen video status failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to check HeyGen video status" }, { status: 500 });
  }
}
