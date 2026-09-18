import RunwayML from "@runwayml/sdk";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RUNWAYML_API_SECRET;
    const { ids } = (await req.json()) as { ids?: string[] };
    if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured");
    if (!Array.isArray(ids) || !ids[0]) return Response.json({ error: "A Runway task ID is required" }, { status: 400 });

    const client = new RunwayML({ apiKey });
    const task = await client.tasks.retrieve(ids[0]);
    if (task.status !== "SUCCEEDED" || !task.output[0]) throw new Error("Runway video is not ready");
    const video = await fetch(task.output[0]);
    if (!video.ok) throw new Error("Runway video download failed");
    return new Response(await video.arrayBuffer(), { headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=helloai-cinematic-video.mp4" } });
  } catch (error) {
    console.error("Runway download failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to download cinematic video" }, { status: 500 });
  }
}
