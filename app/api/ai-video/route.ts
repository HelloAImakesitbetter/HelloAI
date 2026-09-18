import RunwayML from "@runwayml/sdk";

type SceneInput = { imageUrl?: string };

function durationFromBrief(text: string) {
  const match = text.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?)/i);
  if (!match) return 10;
  const value = Number(match[1]) * (/minutes?|mins?/i.test(match[2]) ? 60 : 1);
  return Math.min(Math.max(value, 5), 10);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const { businessName, description, script, scenes } = (await req.json()) as { businessName?: string; description?: string; script?: string; scenes?: SceneInput[] };
    if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured");
    if (!script || typeof script !== "string") return Response.json({ error: "A script is required" }, { status: 400 });

    const promptImage = scenes?.[0]?.imageUrl;
    if (!promptImage) return Response.json({ error: "Create scenes before generating the cinematic video" }, { status: 400 });

    const client = new RunwayML({ apiKey });
    const task = await client.imageToVideo.create({
      model: "gen4_turbo",
      promptImage,
      promptText: `Create a realistic cinematic commercial for ${businessName || "this business"}. Tell this visual story with continuous action: a customer completes a cleaning booking, the team receives the job and travels to the customer's house, the team arrives with supplies, cleaners enter the property and actively vacuum, mop, wipe surfaces, clean the kitchen and bathroom, inspect their work, and the happy customer walks through the freshly cleaned home. Show real locations, practical tools, walking, opening doors, lifting supplies, bending, reaching, and purposeful body movement. Make the people look like real workers in a real home, not static presenters. Use natural camera movement and cinematic cuts. Do not show text, subtitles, logos, or spoken dialogue; narration is added separately. Story direction: ${description || script}`.slice(0, 15000),
      ratio: "1280:720",
      duration: durationFromBrief(description || script),
    });

    return Response.json({ ids: [task.id], status: "queued", progress: 0 });
  } catch (error) {
    console.error("Runway cinematic generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate cinematic video" }, { status: 500 });
  }
}
