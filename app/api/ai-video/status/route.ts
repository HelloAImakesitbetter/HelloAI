import OpenAI from "openai";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const id = new URL(req.url).searchParams.get("id");

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!id) {
      return Response.json({ error: "A video ID is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const video = await openai.videos.retrieve(id);

    return Response.json({
      id: video.id,
      status: video.status,
      progress: video.progress,
      error: video.error?.message || null,
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
