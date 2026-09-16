import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { businessName, script } = (await req.json()) as {
      businessName?: string;
      script?: string;
    };

    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const video = await openai.videos.create({
      model: "sora-2",
      seconds: "8",
      size: "1280x720",
      prompt: `Create a polished, realistic commercial video for ${businessName || "this business"}. Show continuous natural motion, camera movement, and people interacting with the setting. Do not show captions, subtitles, logos, or text on screen. Use this marketing script as creative direction:\n\n${script}`,
    });

    return Response.json({ id: video.id, status: video.status, progress: video.progress });
  } catch (error) {
    console.error("AI video generation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate AI video",
      },
      { status: 500 }
    );
  }
}
