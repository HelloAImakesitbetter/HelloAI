import OpenAI from "openai";

export type WebsitePage = {
  slug: string;
  label: string;
  pageType?: string;
  request?: string;
  isGenerated?: boolean;
  showInNavigation?: boolean;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  imagePrompt: string;
  sections?: { heading: string; body: string; items: string[]; layout: "cards" | "split" | "faq" | "steps" }[];
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

export type WebsitePagePlan = Pick<WebsitePage, "slug" | "label" | "pageType" | "request">;

function parseJsonObject(output: string, errorMessage: string): Record<string, unknown> {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error(errorMessage);
  const parsed: unknown = JSON.parse(output.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(errorMessage);
  return parsed as Record<string, unknown>;
}

function makeSlug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function parseWebsiteSitemap(output: string): { pages: WebsitePagePlan[]; growthPack?: WebsiteDraft["growthPack"] } {
  const result = parseJsonObject(output, "The AI returned an invalid page plan");
  if (!Array.isArray(result.pages) || result.pages.length < 1 || result.pages.length > 20) {
    throw new Error("The AI returned an empty or oversized page plan");
  }

  const slugs = new Set<string>();
  const pages = result.pages.map((page): WebsitePagePlan => {
    if (!page || typeof page !== "object" || Array.isArray(page)) throw new Error("The AI returned an invalid page in the site map");
    const record = page as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
    const slug = typeof record.slug === "string" ? makeSlug(record.slug) : makeSlug(label);
    if (!label || !slug || slugs.has(slug)) throw new Error("The AI returned an incomplete or duplicate page in the site map");
    slugs.add(slug);
    return {
      slug,
      label,
      pageType: typeof record.pageType === "string" ? record.pageType.slice(0, 60) : "standard",
      request: typeof record.request === "string" ? record.request.slice(0, 500) : `Create a useful ${label} page based on the business brief.`,
    };
  });
  if (!slugs.has("home")) throw new Error("The page plan must include a home page");

  let growthPack: WebsiteDraft["growthPack"];
  if (result.growthPack && typeof result.growthPack === "object" && !Array.isArray(result.growthPack)) {
    const candidate = result.growthPack as Record<string, unknown>;
    if (
      Array.isArray(candidate.blogs) &&
      candidate.blogs.every((blog) => blog && typeof blog === "object" && typeof blog.title === "string" && typeof blog.keyword === "string" && typeof blog.outline === "string") &&
      Array.isArray(candidate.localPages) &&
      candidate.localPages.every((page) => typeof page === "string") &&
      Array.isArray(candidate.faq) &&
      candidate.faq.every((item) => item && typeof item === "object" && typeof item.question === "string" && typeof item.answer === "string")
    ) {
      growthPack = candidate as WebsiteDraft["growthPack"];
    }
  }
  return { pages, growthPack };
}

export async function generateWebsiteSitemap(input: WebsiteGenerationInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.description.trim()) throw new Error("A website brief is required");

  const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  const response = await openai.responses.create({
    model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
    text: { format: { type: "json_object" } },
    input: `Plan the page structure for a small-business website for ${input.businessName || "this business"}. Do not write the full page copy yet; each page will be generated and reviewed separately.

Business brief: ${input.description}
Industry: ${input.industry || "Not specified"}
Location: ${input.location || "Not specified"}
Known services: ${input.services || "Infer from the brief"}
Audience: ${input.audience || "Not specified"}
Primary conversion action: ${input.primaryAction || "Contact the business"}

Return JSON with pages and growthPack. Create 5 to 12 relevant pages, including a home page with slug "home" and pages such as about, services, contact, FAQ, or bookings only when appropriate. Include pages for specifically requested services. Every page needs a unique slug, a concise customer-facing label, pageType, and a specific request describing the content to write when that page is generated. Do not generate page copy in this step. Include four blog ideas, justified local pages, and FAQs in growthPack. Avoid unnecessary or duplicate pages, fake claims, and placeholder text.`,
  });
  return parseWebsiteSitemap(response.output_text);
}

export async function generateWebsitePage(input: {
  business: WebsiteGenerationInput;
  page: WebsitePagePlan;
  instruction?: string;
  existingPages: Pick<WebsitePage, "label" | "slug" | "title" | "intro" | "isGenerated">[];
}): Promise<WebsitePage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.business.description.trim()) throw new Error("A website brief is required");
  if (!input.page.label.trim() || !makeSlug(input.page.slug)) throw new Error("A valid planned page is required");

  const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  const response = await openai.responses.create({
    model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
    text: { format: { type: "json_object" } },
    input: `Write only this one customer-facing website page for ${input.business.businessName || "the business"}. Do not write any other pages.

Business brief: ${input.business.description}
Industry: ${input.business.industry || "Not specified"}
Location: ${input.business.location || "Not specified"}
Phone: ${input.business.phone || "Not specified"}
Email: ${input.business.email || "Not specified"}
Services: ${input.business.services || "Not specified"}
Audience: ${input.business.audience || "Not specified"}
Brand voice: ${input.business.tone || "Clear, confident, and human"}
Primary action: ${input.business.primaryAction || "Contact the business"}

Page label: ${input.page.label}
Page type: ${input.page.pageType || "standard"}
Page-specific brief: ${input.instruction?.trim() || input.page.request || "Write the most useful version of this page for the customer."}
Other pages already in the plan: ${JSON.stringify(input.existingPages.filter((page) => page.slug !== input.page.slug).map(({ label, slug, title, intro, isGenerated }) => ({ label, slug, title: isGenerated ? title : "", summary: isGenerated ? intro.slice(0, 300) : "" })))}

Return valid JSON only with slug, label, title, tagline, intro, primaryCta, secondaryCta, benefits (3 to 5 strings), steps (3 to 5 strings), closing, imagePrompt, sections, seoTitle, and seoDescription. Sections must contain 4 to 6 objects with heading, body, items (2 to 5 useful strings), and layout ("cards", "split", "faq", or "steps"). Build a page with a clear information hierarchy and genuinely useful content, not repeated generic filler. Use cards for distinct services/benefits, split for explanatory content, faq only for genuine questions, and steps for process. Use no fabricated testimonials, statistics, awards, certifications, or guarantees. Keep the requested slug and label unchanged. No HTML or markdown. Keep seoTitle under 60 characters and seoDescription between 120 and 160 characters.`,
  });

  const result = parseJsonObject(response.output_text, "The AI returned an invalid page draft");
  const requiredTextFields = ["title", "tagline", "intro", "seoTitle", "seoDescription"];
  const hasInvalidText = requiredTextFields.some((field) => typeof result[field] !== "string" || !(result[field] as string).trim()) ||
    ["primaryCta", "secondaryCta", "closing", "imagePrompt"].some((field) => typeof result[field] !== "string");
  const hasInvalidLists = ["benefits", "steps"].some((field) => !Array.isArray(result[field]) || !(result[field] as unknown[]).length || (result[field] as unknown[]).length > 8 || !(result[field] as unknown[]).every((item) => typeof item === "string" && item.trim()));
  const validLayouts = new Set(["cards", "split", "faq", "steps"]);
  const hasInvalidSections = !Array.isArray(result.sections) || result.sections.length < 3 || result.sections.length > 8 ||
    !result.sections.every((section) => section && typeof section === "object" && typeof section.heading === "string" && section.heading.trim() &&
      typeof section.body === "string" && section.body.trim() && Array.isArray(section.items) && section.items.length >= 2 && section.items.length <= 6 &&
      section.items.every((item: unknown) => typeof item === "string" && item.trim()) && validLayouts.has(section.layout));
  if (result.slug !== input.page.slug || result.label !== input.page.label || hasInvalidText || hasInvalidLists || hasInvalidSections) {
    throw new Error("The AI returned incomplete page content");
  }
  return {
    slug: input.page.slug,
    label: input.page.label,
    pageType: input.page.pageType,
    request: input.instruction?.trim() || input.page.request,
    isGenerated: true,
    showInNavigation: true,
    title: result.title as string,
    tagline: result.tagline as string,
    intro: result.intro as string,
    primaryCta: result.primaryCta as string,
    secondaryCta: result.secondaryCta as string,
    benefits: (result.benefits as string[]).slice(0, 8),
    steps: (result.steps as string[]).slice(0, 8),
    closing: result.closing as string,
    imagePrompt: result.imagePrompt as string,
    sections: (result.sections as { heading: string; body: string; items: string[]; layout: "cards" | "split" | "faq" | "steps" }[]).map((section) => ({
      heading: section.heading.slice(0, 120),
      body: section.body.slice(0, 1200),
      items: section.items.map((item) => item.slice(0, 300)),
      layout: section.layout,
    })),
    seoTitle: result.seoTitle as string,
    seoDescription: result.seoDescription as string,
  };
}

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