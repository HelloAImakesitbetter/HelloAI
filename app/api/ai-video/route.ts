function getRequestedDuration(text: string) {
  const match = text.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?)/i);
  if (!match) return 60;
  const amount = Number(match[1]);
  const seconds = /minutes?|mins?/i.test(match[2]) ? amount * 60 : amount;
  return Math.min(Math.max(seconds, 10), 180);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.HEYGEN_API_KEY;
    const { businessName, script, description } = (await req.json()) as {
      businessName?: string;
      script?: string;
      description?: string;
    };

    const avatarId = process.env.HEYGEN_AVATAR_ID;
    const voiceId = process.env.HEYGEN_VOICE_ID;

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (!avatarId) throw new Error("HEYGEN_AVATAR_ID is not configured");
    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const duration = getRequestedDuration(description || script);
    const response = await fetch("https://api.heygen.com/v3/videos", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "avatar",
        avatar_id: avatarId,
        ...(voiceId ? { voice_id: voiceId } : {}),
        script: `Create a realistic business presentation for ${businessName || "this business"}. Speak this dialogue naturally with clear facial expressions, eye contact, and accurate lip synchronization. Do not say speaker names aloud and do not use a narrator.\n\n${script}`,
        title: `${businessName || "HelloAI"} talking video`,
        resolution: "720p",
        aspect_ratio: "16:9",
        motion_prompt: "Natural eye contact, expressive face, subtle hand gestures, calm confident delivery.",
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || data?.message || "HeyGen video request failed");

    const videoId = data?.data?.video_id;
    if (!videoId) throw new Error("HeyGen did not return a video ID");

    return Response.json({ ids: [videoId], duration, status: "queued", progress: 0 });
  } catch (error) {
    console.error("HeyGen video generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate HeyGen video" }, { status: 500 });
  }
}
