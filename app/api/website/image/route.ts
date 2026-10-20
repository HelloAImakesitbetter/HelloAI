import OpenAI from "openai";
import { getAuthenticatedSupabase } from "../../../../lib/agent-auth";

export async function POST(request: Request) {
  try {
    const authentication = await getAuthenticatedSupabase(request);
    if ("error" in authentication) return authentication.error;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const body = await request.json() as { businessName?: unknown; industry?: unknown; pageLabel?: unknown; imagePrompt?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Page details are required" }, { status: 400 });
    }
    for (const [label, value, limit] of [
      ["Business name", body.businessName, 120],
      ["Industry", body.industry, 120],
      ["Page name", body.pageLabel, 80],
      ["Image brief", body.imagePrompt, 800],
    ] as const) {
      if (typeof value !== "string" || !value.trim() || value.length > limit) {
        return Response.json({ error: `${label} must be provided and under ${limit} characters` }, { status: 400 });
      }
    }

    const openai = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 });
    const generated = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Create a high-end, photorealistic, editorial-quality wide website hero photograph for a real small business. Business: ${body.businessName}. Industry: ${body.industry}. Specific page: ${body.pageLabel}. Visual direction: ${body.imagePrompt}. Natural light, sophisticated composition, realistic materials and people, premium commercial photography, subtle authentic detail. Compose for a wide 3:2 crop with the main subject in the right two thirds and calmer negative space on the left. No text, lettering, logos, watermark, UI, collage, borders, or artificial-looking effects.`,
      size: "1536x1024",
      quality: "high",
      output_format: "jpeg",
    });
    const base64 = generated.data?.[0]?.b64_json;
    if (!base64) throw new Error("The image generator returned no image");
    return Response.json({ imageDataUrl: `data:image/jpeg;base64,${base64}` });
  } catch (error) {
    console.error("Website hero image generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate a website image" }, { status: 500 });
  }
}
