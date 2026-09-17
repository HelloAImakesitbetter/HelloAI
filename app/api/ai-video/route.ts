import RunwayML from "@runwayml/sdk";

type SceneInput = {
  imageUrl?: string;
};

function getRequestedDuration(text: string) {
  const match = text.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?)/i);

  if (!match) {
    return 60;
  }

  const amount = Number(match[1]);
  const durationInSeconds = /minutes?|mins?/i.test(match[2]) ? amount * 60 : amount;

  return Math.min(Math.max(durationInSeconds, 10), 120);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;

    if (!apiKey) {
      throw new Error("RUNWAYML_API_SECRET is not configured");
    }

    const { businessName, script, description, scenes } = (await req.json()) as {
      businessName?: string;
      script?: string;
      description?: string;
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
    const requestedDuration = getRequestedDuration(description || script);
    const clipDuration = 30;
    const clipCount = Math.ceil(requestedDuration / clipDuration);
    const prompts = Array.from({ length: clipCount }, (_, index) =>
      index === 0
        ? "Opening and setup: establish the location and introduce the group."
        : index === clipCount - 1
          ? "Final section: bring the story to a satisfying conclusion."
          : "Middle section: continue the story with fresh natural movement and interaction."
    );
    const tasks = await Promise.all(
      prompts.map((segment, index) =>
        runway.imageToVideo.create({
          model: "wan3",
          promptImage,
          promptText: `Create a polished, realistic commercial video for ${businessName || "this business"}. This is section ${index + 1} of ${clipCount} in a ${requestedDuration}-second video. ${segment} Animate exactly five distinct adult characters visible in the reference image, keeping each person's appearance consistent. Show natural movement, camera motion, eye contact, and interaction among the group. Do not show captions, subtitles, logos, or text on screen. Creative direction:\n\n${script}`.slice(0, 15000),
          ratio: "1280:720",
          duration: Math.min(clipDuration, requestedDuration - index * clipDuration),
          audio: false,
        })
      )
    );

    return Response.json({
      ids: tasks.map((task) => task.id),
      duration: requestedDuration,
      status: "queued",
      progress: 0,
    });
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
