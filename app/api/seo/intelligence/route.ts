import OpenAI from "openai";

type Audit = { pagesChecked?: number; score?: number; pages?: { url: string; title: string; wordCount: number }[]; issues?: { key: string; label: string; detail: string }[] };

function parseJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("The AI returned an invalid growth plan");
  return JSON.parse(output.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const { businessName, description, location, websiteUrl, competitorUrl, audit } = await req.json() as { businessName?: string; description?: string; location?: string; websiteUrl?: string; competitorUrl?: string; audit?: Audit };
    if (!description?.trim() && !websiteUrl?.trim()) return Response.json({ error: "Add a business description or website URL" }, { status: 400 });

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Act as an SEO strategist, local growth agency, content team, and conversion consultant. Create an execution-ready growth opportunity map for this business.

Business: ${businessName || "Unknown"}
Description: ${description || "Infer from the crawl"}
Location: ${location || "Unknown"}
Website: ${websiteUrl || "Not provided"}
Competitor URL: ${competitorUrl || "Not provided"}
Current crawl summary: ${JSON.stringify(audit || {})}

Return valid JSON only with this shape:
{
  "summary": "",
  "missingServicePages": [{ "title": "", "keyword": "", "reason": "", "priority": "High" }],
  "locationPages": [{ "title": "", "keyword": "", "localAngle": "", "priority": "High" }],
  "landingPages": [{ "title": "", "audience": "", "offer": "", "priority": "High" }],
  "contentClusters": [{ "topic": "", "supportingArticles": ["", "", ""] }],
  "conversionFixes": [{ "issue": "", "fix": "", "impact": "High" }],
  "competitorGaps": [{ "opportunity": "", "whyItMatters": "", "nextAction": "" }],
  "forecast": { "currentMonthlyTraffic": 0, "estimatedMonthlyTraffic": 0, "assumptions": ["", "", ""] },
  "autopilot": ["", "", "", "", ""]
}

Use the supplied location and business context. Suggest nearby areas only when plausible, never invent rankings or traffic data, and mark estimates as assumptions. Make pages genuinely distinct with useful local angles, not doorway-page spam. Prioritize actions that can generate leads.`,
    });
    return Response.json({ intelligence: parseJson(response.output_text) });
  } catch (error) {
    console.error("SEO intelligence failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to build growth plan" }, { status: 500 });
  }
}
