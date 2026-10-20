import { generateWebsiteDraft } from "../../../lib/website-generator";

export async function POST(req: Request) {
  try {
    const { businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction } = (await req.json()) as { businessName?: string; description?: string; industry?: string; location?: string; phone?: string; email?: string; websiteUrl?: string; services?: string; audience?: string; tone?: string; primaryAction?: string };

    if (!description || typeof description !== "string") {
      return Response.json({ error: "A website brief is required" }, { status: 400 });
    }

    const draft = await generateWebsiteDraft({ businessName, description, industry, location, phone, email, websiteUrl, services, audience, tone, primaryAction });
    return Response.json({ draft });
  } catch (error) {
    console.error("Website generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to build website" }, { status: 500 });
  }
}
