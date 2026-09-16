import RunwayML from "@runwayml/sdk";

type SceneInput = {
  imageUrl?: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;

    if (!apiKey) {
      throw new Error("RUNWAYML_API_SECRET is not configured");
    }

    const { businessName, script, scenes } = (await req.json()) as {
      businessName?: string;
      script?: string;
      scenes?: SceneInput[];
    };

    if (!script || typeof script !== "string") {
      return Response.json({ error: "A script is required" }, { status: 400 });
    }

    const promptImage = scenes?.[0]?.imageUrl;

    if (!promptImage) {
      return Response.json(
        { error: "Generate scene images before creating an AI video" },
        { status: 400 }
      );
    }

    const runway = new RunwayML({ apiKey });
    const task = await runway.imageToVideo.create({
      model: "gen4.5",
      promptImage,
      promptText: `Create a polished, realistic commercial video for ${businessName || "this business"}. Animate the people and environment with natural movement, camera motion, eye contact, and interaction. Keep the characters' appearance consistent with the reference image. Do not show captions, subtitles, logos, or text on screen. Creative direction:\n\n${script}`.slice(0, 1000),
      ratio: "1280:720",
      duration: 10,
      outputFormat: "mp4",
    });

    return Response.json({ id: task.id, status: "queued", progress: 0 });
  } catch (error) {
    console.error("AI video generation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate Runway video",
      },
      { status: 500 }
    );
  }
}
