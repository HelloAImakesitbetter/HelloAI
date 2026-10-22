import OpenAI from "openai";
import { rateLimit } from "../../../../lib/rate-limit";

type Page = Record<string, unknown>;

export async function POST(req: Request) {
  const limited = rateLimit(req, "website-refine", 30, 10 * 60_000);
  if (limited) return limited;

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

Return valid JSON only with these fields: title, tagline, intro, primaryCta, secondaryCta, benefits (array of 3 to 5 strings), steps (array of 3 to 5 strings), closing, imagePrompt, sections, seoTitle, seoDescription. Sections must contain 4 to 6 objects with heading, body, items (2 to 5 useful strings), and layout ("cards", "split", "faq", or "steps").
Keep the copy specific, credible, conversion-focused, and free of fake claims. Keep seoTitle under 60 characters and seoDescription between 120 and 160 characters.`,
    });
    const start = response.output_text.indexOf("{");
    const end = response.output_text.lastIndexOf("}");
    if (start === -1 || end < start) throw new Error("The AI returned an invalid page refinement");
    const refinedPage = JSON.parse(response.output_text.slice(start, end + 1)) as Record<string, unknown>;
    const validLayouts = new Set(["cards", "split", "faq", "steps"]);
    if (!Array.isArray(refinedPage.sections) || refinedPage.sections.length < 3 || refinedPage.sections.length > 8 ||
      !refinedPage.sections.every((section) => section && typeof section === "object" && typeof section.heading === "string" && section.heading.trim() &&
        typeof section.body === "string" && Array.isArray(section.items) && section.items.length >= 2 && section.items.length <= 6 &&
        section.items.every((item: unknown) => typeof item === "string" && item.trim()) && validLayouts.has(section.layout))) {
      throw new Error("The AI returned incomplete page sections");
    }
    return Response.json({ page: refinedPage });
  } catch (error) {
    console.error("Website page refinement failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to refine page" }, { status: 500 });
  }
}
