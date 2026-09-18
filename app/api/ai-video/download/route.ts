export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { ids } = (await req.json()) as { ids?: string[] };

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (!Array.isArray(ids) || !ids[0]) return Response.json({ error: "A HeyGen session ID is required" }, { status: 400 });

    const videoResponse = await fetch(`https://api.heygen.com/v3/videos/${encodeURIComponent(ids[0])}`, { headers: { "X-Api-Key": apiKey } });
    const videoData = await videoResponse.json();
    const videoUrl = videoData?.data?.video_url;
    if (!videoResponse.ok || !videoUrl) throw new Error("HeyGen video URL is not available");

    const content = await fetch(videoUrl);
    if (!content.ok) throw new Error("HeyGen video download failed");

    return new Response(await content.arrayBuffer(), {
      headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=helloai-talking-video.mp4" },
    });
  } catch (error) {
    console.error("HeyGen video download failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to download HeyGen video" }, { status: 500 });
  }
}
