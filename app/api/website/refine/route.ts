import OpenAI from "openai";

type Page = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const { page, instruction, businessName, audience, tone } = await req.json() as { page?: Page; instruction?: string; businessName?: string; audience?: string; tone?: string };
    if (!page || typeof page !== "object") return Response.json({ error: "A page is required" }, { status: 400 });
    if (!instruction?.trim()) return Response.json({ error: "A refinement instruction is required" }, { status: 400 });

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Improve this website page without changing its slug or label.

Business: ${businessName || "Not provided"}
Audience: ${audience || "Not provided"}
Brand voice: ${tone || "Clear and human"}
Instruction: ${instruction}
Current page JSON:
${JSON.stringify(page)}

Return valid JSON only with these fields: title, tagline, intro, primaryCta, secondaryCta, benefits (array of 3 strings), steps (array of 3 strings), closing, imagePrompt, seoTitle, seoDescription.
Keep the copy specific, credible, conversion-focused, and free of fake claims. Keep seoTitle under 60 characters and seoDescription between 120 and 160 characters.`,
    });
    const start = response.output_text.indexOf("{");
    const end = response.output_text.lastIndexOf("}");
    if (start === -1 || end < start) throw new Error("The AI returned an invalid page refinement");
    return Response.json({ page: JSON.parse(response.output_text.slice(start, end + 1)) });
  } catch (error) {
    console.error("Website page refinement failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to refine page" }, { status: 500 });
  }
}
