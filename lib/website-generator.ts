import OpenAI from "openai";

export type WebsitePage = {
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

export type WebsiteDraft = {
  pages: WebsitePage[];
  growthPack?: {
    blogs: { title: string; keyword: string; outline: string }[];
    localPages: string[];
    faq: { question: string; answer: string }[];
  };
};

export type WebsiteGenerationInput = {
  businessName?: string;
  description: string;
  industry?: string;
  location?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  services?: string;
  audience?: string;
  tone?: string;
  primaryAction?: string;
};

export function parseWebsiteDraft(output: string): WebsiteDraft {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("The AI returned an invalid website draft");

  const draft = JSON.parse(output.slice(start, end + 1)) as WebsiteDraft;
  if (!Array.isArray(draft.pages) || draft.pages.length < 6 || draft.pages.length > 20) {
    throw new Error("The AI returned an incomplete or oversized site map");
  }

  for (const page of draft.pages) {
    if (!page || typeof page !== "object" || !page.slug || !page.label || !page.title || !page.tagline || !page.intro || !page.seoTitle || !page.seoDescription || !Array.isArray(page.benefits) || !Array.isArray(page.steps)) {
      throw new Error("The AI returned incomplete page content");
    }
  }

  return draft;
}

export async function generateWebsiteDraft(input: WebsiteGenerationInput): Promise<WebsiteDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.description.trim()) throw new Error("A website brief is required");

  const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  const response = await openai.responses.create({
    model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
    text: { format: { type: "json_object" } },
    input: `Create a complete multi-page small-business website and growth pack for ${input.businessName || "this business"}.

Business brief:
${input.description}

Industry: ${input.industry || "Not specified"}
Location: ${input.location || "Not specified"}
Phone: ${input.phone || "Not specified"}
Email: ${input.email || "Not specified"}
Existing website: ${input.websiteUrl || "Not specified"}
Known services: ${input.services || "Infer services from the brief"}
Ideal audience: ${input.audience || "Not specified"}
Brand voice: ${input.tone || "Clear, confident, and human"}
Primary conversion action: ${input.primaryAction || "Contact the business"}

Return only valid JSON with pages and growthPack. Every page must include slug, label, title, tagline, intro, primaryCta, secondaryCta, benefits, steps, closing, imagePrompt, seoTitle, and seoDescription. Include at least Home, About Us, Contact Us, FAQ, Bookings, and Services, plus pages for important services inferred from the brief. Generate four blog ideas for the first month, justified local landing pages, and an FAQ array. Include natural internal-link targets, H2 structures, and LocalBusiness or Service schema types. Write credible customer-facing copy with no fake claims or placeholder text. Keep SEO titles under 60 characters and SEO descriptions between 120 and 160 characters. Do not include HTML or markdown.`,
  });

  return parseWebsiteDraft(response.output_text);
}