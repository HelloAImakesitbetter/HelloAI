import OpenAI, { toFile } from "openai";

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);

  if (!match) {
    throw new Error("Please provide a PNG, JPEG, or WebP image");
  }

  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { imageDataUrl, prompt } = (await req.json()) as {
      imageDataUrl?: string;
      prompt?: string;
    };

    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    if (!imageDataUrl || !prompt?.trim()) {
      return Response.json({ error: "An image and edit request are required" }, { status: 400 });
    }

    const { mimeType, bytes } = decodeDataUrl(imageDataUrl);
    const openai = new OpenAI({ apiKey });
    const image = await openai.images.edit({
      model: "gpt-image-1",
      image: await toFile(bytes, `source.${mimeType.split("/")[1]}`),
      prompt: `Edit this photo naturally while preserving the person's identity, face, age, skin tone, and realistic proportions. Apply only the requested change. Do not add text, logos, extra people, or distort the image. Request: ${prompt.trim()}`,
      input_fidelity: "high",
      output_format: "jpeg",
      quality: "medium",
      size: "1024x1024",
    });
    const imageData = image.data?.[0]?.b64_json;

    if (!imageData) throw new Error("The image editor returned no image");
    return Response.json({ imageDataUrl: `data:image/jpeg;base64,${imageData}` });
  } catch (error) {
    console.error("AI image edit failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to edit image" }, { status: 500 });
  }
}
