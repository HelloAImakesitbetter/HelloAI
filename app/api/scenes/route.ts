import OpenAI from "openai";

type ScenePrompt = {
  scene: number;
  imagePrompt: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { script } = await req.json();

    if (!script || typeof script !== "string") {
      return Response.json(
        { error: "A script is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const sceneResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Break this marketing video script into exactly three visual scenes. Return only a valid JSON array with this shape: [{"scene":1,"imagePrompt":"..."}]. Each imagePrompt should describe a polished, realistic commercial image with no text or logos in the image.\n\nScript:\n${script}`,
    });

    const rawSceneOutput = sceneResponse.output_text.trim();
    const jsonStart = rawSceneOutput.indexOf("[");
    const jsonEnd = rawSceneOutput.lastIndexOf("]");

    if (jsonStart === -1 || jsonEnd < jsonStart) {
      throw new Error("The model returned invalid scene JSON");
    }

    const scenePrompts = JSON.parse(
      rawSceneOutput.slice(jsonStart, jsonEnd + 1)
    ) as ScenePrompt[];

    if (
      !Array.isArray(scenePrompts) ||
      scenePrompts.length === 0 ||
      scenePrompts.some(
        (scene) =>
          typeof scene.scene !== "number" ||
          typeof scene.imagePrompt !== "string" ||
          !scene.imagePrompt.trim()
      )
    ) {
      throw new Error("The model returned invalid scene data");
    }

    const scenes = await Promise.all(
      scenePrompts.slice(0, 3).map(async (scene) => {
        const image = await openai.images.generate({
          model: "gpt-image-1",
          prompt: scene.imagePrompt,
          size: "1024x1024",
          quality: "low",
          output_format: "jpeg",
        });
        const imageData = image.data?.[0]?.b64_json;

        if (!imageData) {
          throw new Error(`No image returned for scene ${scene.scene}`);
        }

        return {
          ...scene,
          imageUrl: `data:image/jpeg;base64,${imageData}`,
        };
      })
    );

    return Response.json({ scenes });
  } catch (error) {
    console.error("Scene generation failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate scenes",
      },
      { status: 500 }
    );
  }
}
