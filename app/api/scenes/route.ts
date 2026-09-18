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

    const { script, businessName, description } = (await req.json()) as {
      script?: string;
      businessName?: string;
      description?: string;
    };

    if (!script || typeof script !== "string") {
      return Response.json(
        { error: "A script is required" },
        { status: 400 }
      );
    }

    const speakers = Array.from(
      new Set(
        script
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*([^:]{1,40})\s*:/)?.[1]?.trim())
          .filter((speaker): speaker is string => Boolean(speaker))
          .filter((speaker) => !/^(narrator|voiceover|scene|director)$/i.test(speaker))
      )
    ).slice(0, 5);
    const castDescription = speakers.length
      ? `The exact recurring cast is: ${speakers.join(", ")}. Keep these same people, appearances, clothing palette, ages, and roles consistent across every scene.`
      : "Keep the same recurring people and visual identity consistent across every scene.";

    const openai = new OpenAI({ apiKey });
    const sceneResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Break this marketing video into exactly three visual scenes that directly match the dialogue and business brief. Return only a valid JSON array with this shape: [{"scene":1,"imagePrompt":"..."}]. Each imagePrompt must describe the people and action that the dialogue is discussing, use the same recurring cast in every scene, and contain no text, captions, logos, or invented unrelated people.\n\nBusiness: ${businessName || "Unnamed business"}\nBrief: ${description || "Not provided"}\n${castDescription}\n\nDialogue:\n${script}`,
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
