export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { ids } = (await req.json()) as { ids?: string[] };

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured. Add it in Vercel.");
    if (!Array.isArray(ids) || !ids[0]) {
      return Response.json({ error: "A HeyGen video ID is required" }, { status: 400 });
    }

    const statusResponse = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(ids[0])}`,
      { headers: { "X-Api-Key": apiKey } }
    );
    const statusData = await statusResponse.json();
    const videoUrl = statusData?.data?.video_url;

    if (!statusResponse.ok || !videoUrl) {
      throw new Error(statusData?.data?.error || statusData?.error?.message || "HeyGen video is not ready");
    }

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("HeyGen video download failed");

    return new Response(await videoResponse.arrayBuffer(), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=helloai-talking-video.mp4",
      },
    });
  } catch (error) {
    console.error("HeyGen video download failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to download HeyGen video" },
      { status: 500 }
    );
  }
}
