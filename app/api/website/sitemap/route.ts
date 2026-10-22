import { rateLimit } from "../../../../lib/rate-limit";
import { generateWebsiteSitemap } from "../../../../lib/website-generator";

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label} must be text under ${maxLength} characters`);
  return value.trim();
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "website-sitemap", 10, 10 * 60_000);
  if (limited) return limited;

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A website brief is required" }, { status: 400 });
    }
    const description = optionalText(body.description, "Business brief", 4000);
    if (!description) return Response.json({ error: "A business brief is required" }, { status: 400 });

    const sitemap = await generateWebsiteSitemap({
      description,
      businessName: optionalText(body.businessName, "Business name", 120),
      industry: optionalText(body.industry, "Industry", 120),
      location: optionalText(body.location, "Location", 160),
      phone: optionalText(body.phone, "Phone", 80),
      email: optionalText(body.email, "Email", 254),
      websiteUrl: optionalText(body.websiteUrl, "Website URL", 2048),
      services: optionalText(body.services, "Services", 1000),
      audience: optionalText(body.audience, "Audience", 500),
      tone: optionalText(body.tone, "Brand voice", 120),
      primaryAction: optionalText(body.primaryAction, "Primary action", 160),
    });
    return Response.json(sitemap);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to suggest a sitemap";
    console.error("Website sitemap generation failed:", error);
    return Response.json({ error: message }, { status: message.includes("must be text") || message.includes("required") ? 400 : 500 });
  }
}
