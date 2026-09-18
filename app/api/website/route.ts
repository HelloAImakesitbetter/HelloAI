import OpenAI from "openai";

type WebsitePage = {
  slug: string;
  label: string;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  seoTitle: string;
  seoDescription: string;
};

type WebsiteDraft = { pages: WebsitePage[] };

function parseDraft(output: string): WebsiteDraft {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("The AI returned an invalid website draft");

  const draft = JSON.parse(output.slice(start, end + 1)) as WebsiteDraft;
  if (!Array.isArray(draft.pages) || draft.pages.length !== 4) {
    throw new Error("The AI returned an incomplete site map");
  }

  for (const page of draft.pages) {
    if (!page.slug || !page.label || !page.title || !page.tagline || !page.intro || !page.seoTitle || !page.seoDescription || !Array.isArray(page.benefits) || !Array.isArray(page.steps)) {
      throw new Error("The AI returned incomplete page content");
    }
  }

  return draft;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { businessName, description } = (await req.json()) as { businessName?: string; description?: string };

    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    if (!description || typeof description !== "string") {
      return Response.json({ error: "A website brief is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Create a polished four-page small-business website draft for ${businessName || "this business"}.

Business brief:
${description}

Return only valid JSON with this exact shape:
{"pages":[{"slug":"home","label":"Home","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","seoTitle":"","seoDescription":""},{"slug":"services","label":"Services","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","seoTitle":"","seoDescription":""},{"slug":"about","label":"About","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","seoTitle":"","seoDescription":""},{"slug":"contact","label":"Contact","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","seoTitle":"","seoDescription":""}]}

Write clear customer-facing copy. Keep the four pages distinct. Write SEO titles under 60 characters and SEO descriptions between 120 and 160 characters using natural local search language from the brief. Do not include HTML, markdown, fake statistics, unverifiable claims, or placeholder text.`,
    });

    return Response.json({ draft: parseDraft(response.output_text) });
  } catch (error) {
    console.error("Website generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to build website" }, { status: 500 });
  }
}
