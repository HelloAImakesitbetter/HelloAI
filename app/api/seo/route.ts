import OpenAI from "openai";

type SeoPage = {
  page: string;
  keyword: string;
  title: string;
  description: string;
  intent: string;
};

type SeoReport = {
  summary: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  pages: SeoPage[];
  localActions: string[];
  contentIdeas: { title: string; keyword: string; format: string }[];
  checklist: { task: string; priority: "High" | "Medium" | "Low"; reason: string }[];
};

function parseReport(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("The AI returned an invalid SEO report");
  const report = JSON.parse(output.slice(start, end + 1)) as SeoReport;
  if (!report.summary || !report.primaryKeyword || !Array.isArray(report.pages) || !Array.isArray(report.contentIdeas) || !Array.isArray(report.checklist)) {
    throw new Error("The AI returned an incomplete SEO report");
  }
  return report;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { businessName, description, websiteUrl, location } = (await req.json()) as {
      businessName?: string;
      description?: string;
      websiteUrl?: string;
      location?: string;
    };

    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    if (!description?.trim()) return Response.json({ error: "A business description is required" }, { status: 400 });

    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: process.env.HELLOAI_CHAT_MODEL || "gpt-4.1-mini",
      input: `Create a practical SEO growth plan for this business.

Business: ${businessName || "Unnamed business"}
Location: ${location || "Not provided"}
Website: ${websiteUrl || "Not provided"}
Business description: ${description}

Return only valid JSON with this exact shape:
{"summary":"","primaryKeyword":"","secondaryKeywords":["","","","",""],"pages":[{"page":"Home","keyword":"","title":"","description":"","intent":""}],"localActions":["","","",""],"contentIdeas":[{"title":"","keyword":"","format":"Guide"}],"checklist":[{"task":"","priority":"High","reason":""}]}

Create entries for Home, Services, About, and Contact. Use realistic search language, not invented search volume or rankings. Keep SEO titles under 60 characters and descriptions between 120 and 160 characters. Prioritize actions a small business can actually complete. Include location modifiers only when a location is provided. Make content ideas specific to the audience and offer.`,
    });

    return Response.json({ report: parseReport(response.output_text) });
  } catch (error) {
    console.error("SEO plan generation failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate SEO plan" }, { status: 500 });
  }
}
