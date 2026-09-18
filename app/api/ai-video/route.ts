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

    if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const duration = getRequestedDuration(description || script);
    const response = await fetch("https://api.heygen.com/v3/video-agents", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Create a realistic ${duration}-second business video for ${businessName || "this business"}. Use the dialogue below exactly. Each named character must speak their own lines with natural timing, expressions, eye contact, and realistic lip synchronization. Use distinct suitable avatars and voices for each character. Do not use a narrator. Do not show subtitles or placeholder text.\n\n${script}`,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || data?.message || "HeyGen video request failed");

    const sessionId = data?.data?.session_id;
    if (!sessionId) throw new Error("HeyGen did not return a session ID");

    return Response.json({ ids: [sessionId], duration, status: "queued", progress: 0 });
  } catch (error) {
    console.error("HeyGen video generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate HeyGen video" }, { status: 500 });
  }
}
