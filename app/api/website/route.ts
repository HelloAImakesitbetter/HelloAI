import OpenAI from "openai";

type WebsitePage = {
  slug: string;
  label: string;
  pageType?: string;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  imagePrompt: string;
  h2s?: string[];
  internalLinks?: string[];
  schemaType?: string;
  seoTitle: string;
  seoDescription: string;
};

type WebsiteDraft = { pages: WebsitePage[]; growthPack?: { blogs: { title: string; keyword: string; outline: string }[]; localPages: string[]; faq: { question: string; answer: string }[] } };

function parseDraft(output: string): WebsiteDraft {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("The AI returned an invalid website draft");

  const draft = JSON.parse(output.slice(start, end + 1)) as WebsiteDraft;
  if (!Array.isArray(draft.pages) || draft.pages.length < 6) {
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
    const { businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction } = (await req.json()) as { businessName?: string; description?: string; industry?: string; location?: string; phone?: string; email?: string; websiteUrl?: string; services?: string; audience?: string; tone?: string; primaryAction?: string };

    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    if (!description || typeof description !== "string") {
      return Response.json({ error: "A website brief is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Create a complete multi-page small-business website and growth pack for ${businessName || "this business"}.

Business brief:
${description}

Industry: ${industry || "Not specified"}
Location: ${location || "Not specified"}
Phone: ${phone || "Not specified"}
Email: ${email || "Not specified"}
Existing website: ${websiteUrl || "Not specified"}
Known services: ${services || "Infer services from the brief"}

Ideal audience: ${audience || "Not specified"}
Brand voice: ${tone || "Clear, confident, and human"}
Primary conversion action: ${primaryAction || "Contact the business"}

Return only valid JSON with a pages array. Every page must include slug, label, title, tagline, intro, primaryCta, secondaryCta, benefits, steps, closing, imagePrompt, seoTitle, and seoDescription. Also include growthPack with blogs, localPages, and faq arrays.
{"pages":[{"slug":"home","label":"Home","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","imagePrompt":"editorial photo subject and setting, no text or logos","seoTitle":"","seoDescription":""},{"slug":"services","label":"Services","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","imagePrompt":"editorial photo subject and setting, no text or logos","seoTitle":"","seoDescription":""},{"slug":"about","label":"About","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","imagePrompt":"editorial photo subject and setting, no text or logos","seoTitle":"","seoDescription":""},{"slug":"contact","label":"Contact","title":"","tagline":"","intro":"","primaryCta":"","secondaryCta":"","benefits":["","",""],"steps":["","",""],"closing":"","imagePrompt":"editorial photo subject and setting, no text or logos","seoTitle":"","seoDescription":""}]}

Create at least these pages: Home, About Us, Contact Us, FAQ, Bookings, and Services. Add one page for each important service inferred from the brief. Add local landing pages for the provided location and nearby areas only when justified. Generate four blog ideas for the first month. Include natural internal-link targets, H2 structures, and LocalBusiness or Service schema types. Write clear customer-facing copy that reflects the audience, voice, and conversion action. Keep SEO titles under 60 characters and SEO descriptions between 120 and 160 characters. Do not include HTML, markdown, fake statistics, unverifiable claims, or placeholder text.`,
    });

    return Response.json({ draft: parseDraft(response.output_text) });
  } catch (error) {
    console.error("Website generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to build website" }, { status: 500 });
  }
}
