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
    const prompts = [
      "Opening and setup: establish the location and introduce the group.",
      "Continuation and payoff: show the group interacting naturally and conclude the commercial.",
    ];
    const tasks = await Promise.all(
      prompts.map((segment) =>
        runway.imageToVideo.create({
          model: "seedance2_5",
          promptImage,
          promptText: `Create a polished, realistic commercial video for ${businessName || "this business"}. This is one part of a two-part, one-minute video. ${segment} Animate exactly five distinct adult characters visible in the reference image, keeping each person's appearance consistent. Show natural movement, camera motion, eye contact, and interaction among the group. Do not show captions, subtitles, logos, or text on screen. Creative direction:\n\n${script}`.slice(0, 15000),
          ratio: "1280:720",
          duration: 30,
          audio: false,
        })
      )
    );

    return Response.json({ ids: tasks.map((task) => task.id), status: "queued", progress: 0 });
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
