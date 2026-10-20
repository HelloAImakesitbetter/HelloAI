import OpenAI from "openai";

type Audit = { pagesChecked?: number; score?: number; pages?: { url: string; title: string; wordCount: number }[]; issues?: { key: string; label: string; detail: string }[] };
type CompetitorSnapshot = { url: string; title: string; h1Count: number; wordCount: number; internalLinkCount: number; hasDescription: boolean; hasStructuredData: boolean };

function getCompetitorUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (!/^https?:$/.test(url.protocol) || ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) throw new Error("Competitor URL must be a public http(s) website");
  return url;
}

function countMatches(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].length;
}

async function inspectCompetitor(value: unknown): Promise<CompetitorSnapshot | null> {
  const url = getCompetitorUrl(value);
  if (!url) return null;
  const response = await fetch(url, { headers: { "User-Agent": "HelloAI SEO Competitor Snapshot/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Competitor URL did not return a readable HTML page");
  const html = (await response.text()).slice(0, 2_000_000);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim();
  return {
    url: url.toString(),
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "",
    h1Count: countMatches(html, /<h1\b[^>]*>/gi),
    wordCount: text ? text.split(" ").length : 0,
    internalLinkCount: countMatches(html, /<a\b[^>]+href=["'][^"']+["']/gi),
    hasDescription: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html),
    hasStructuredData: /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html),
  };
}

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
    const competitorSnapshot = await inspectCompetitor(competitorUrl).catch((error) => {
      throw new Error(error instanceof Error ? `Competitor analysis failed: ${error.message}` : "Competitor analysis failed");
    });

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Act as an SEO strategist, local growth agency, content team, and conversion consultant. Create an execution-ready growth opportunity map for this business.

Business: ${businessName || "Unknown"}
Description: ${description || "Infer from the crawl"}
Location: ${location || "Unknown"}
Website: ${websiteUrl || "Not provided"}
Competitor URL: ${competitorUrl || "Not provided"}
Competitor snapshot (measured from its public homepage, not rankings or private data): ${JSON.stringify(competitorSnapshot || {})}
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
