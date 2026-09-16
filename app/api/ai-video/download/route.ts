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
    const content = await openai.videos.downloadContent(id);

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
