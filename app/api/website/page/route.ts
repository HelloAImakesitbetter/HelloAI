import { generateWebsitePage, type WebsitePagePlan } from "../../../../lib/website-generator";

function text(value: unknown, label: string, maxLength: number, required = false) {
  if (typeof value !== "string" || value.length > maxLength || (required && !value.trim())) {
    throw new Error(`${label} must be ${required ? "provided and " : ""}text under ${maxLength} characters`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A planned page is required" }, { status: 400 });
    }
    const rawPage = body.page;
    if (!rawPage || typeof rawPage !== "object" || Array.isArray(rawPage)) {
      return Response.json({ error: "A planned page is required" }, { status: 400 });
    }
    const pageRecord = rawPage as Record<string, unknown>;
    const page: WebsitePagePlan = {
      slug: text(pageRecord.slug, "Page slug", 80, true),
      label: text(pageRecord.label, "Page label", 80, true),
      pageType: text(pageRecord.pageType || "standard", "Page type", 60),
      request: text(pageRecord.request || "", "Page request", 500),
    };
    const description = text(body.description, "Business brief", 4000, true);
    const rawExistingPages = body.existingPages;
    if (!Array.isArray(rawExistingPages) || rawExistingPages.length > 20) {
      return Response.json({ error: "Existing page context must be a list of no more than 20 pages" }, { status: 400 });
    }
    const existingPages = rawExistingPages.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Existing page context is invalid");
      const pageContext = value as Record<string, unknown>;
      return {
        slug: text(pageContext.slug, "Existing page slug", 80, true),
        label: text(pageContext.label, "Existing page label", 80, true),
        title: text(pageContext.title || "", "Existing page title", 200),
        intro: text(pageContext.intro || "", "Existing page introduction", 500),
        isGenerated: pageContext.isGenerated === true,
      };
    });

    const generatedPage = await generateWebsitePage({
      page,
      instruction: text(body.instruction || "", "Page instruction", 2000),
      existingPages,
      business: {
        description,
        businessName: text(body.businessName || "", "Business name", 120),
        industry: text(body.industry || "", "Industry", 120),
        location: text(body.location || "", "Location", 160),
        phone: text(body.phone || "", "Phone", 80),
        email: text(body.email || "", "Email", 254),
        websiteUrl: text(body.websiteUrl || "", "Website URL", 2048),
        services: text(body.services || "", "Services", 1000),
        audience: text(body.audience || "", "Audience", 500),
        tone: text(body.tone || "", "Brand voice", 120),
        primaryAction: text(body.primaryAction || "", "Primary action", 160),
      },
    });
    return Response.json({ page: generatedPage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate page";
    console.error("Website page generation failed:", error);
    return Response.json({ error: message }, { status: message.includes("must be") || message.includes("required") ? 400 : 500 });
  }
}
