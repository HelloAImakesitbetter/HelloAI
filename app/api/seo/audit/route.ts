type AuditIssue = {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  fix: string;
};

function firstMatch(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function countMatches(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].length;
}

function getHost(url: string) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Website URL must start with http:// or https://");
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsed.hostname)) throw new Error("Local website URLs cannot be audited");
  return parsed;
}

export async function POST(req: Request) {
  try {
    const { websiteUrl } = (await req.json()) as { websiteUrl?: string };
    if (!websiteUrl?.trim()) return Response.json({ error: "A website URL is required" }, { status: 400 });
    const parsed = getHost(websiteUrl.trim());
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "HelloAI SEO Auditor/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
    const html = (await response.text()).slice(0, 2_000_000);
    const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
    const imageCount = countMatches(html, /<img\b[^>]*>/gi);
    const missingAltCount = [...html.matchAll(/<img\b([^>]*)>/gi)].filter((match) => !/\balt\s*=\s*["'][^"']*["']/i.test(match[1])).length;
    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim();
    const wordCount = text ? text.split(" ").length : 0;
    const robotsResponse = await fetch(new URL("/robots.txt", parsed.origin), { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    const sitemapResponse = await fetch(new URL("/sitemap.xml", parsed.origin), { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(8000) }).catch(() => null);

    const issues: AuditIssue[] = [
      { key: "title", label: "Page title", status: title.length >= 30 && title.length <= 60 ? "pass" : title ? "warning" : "fail", detail: title ? `${title.length} characters` : "No title found", fix: "Write a specific title with the service and location." },
      { key: "description", label: "Meta description", status: description.length >= 120 && description.length <= 160 ? "pass" : description ? "warning" : "fail", detail: description ? `${description.length} characters` : "No meta description found", fix: "Add a useful 120-160 character description with a clear benefit." },
      { key: "h1", label: "Single main heading", status: h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warning", detail: `${h1Count} H1 headings found`, fix: "Use one clear H1 that matches the page's main search intent." },
      { key: "images", label: "Image accessibility", status: imageCount === 0 || missingAltCount === 0 ? "pass" : "warning", detail: imageCount ? `${missingAltCount} of ${imageCount} images need alt text` : "No images found", fix: "Add descriptive alt text that explains the image's purpose." },
      { key: "content", label: "Useful page content", status: wordCount >= 300 ? "pass" : "warning", detail: `${wordCount} readable words found`, fix: "Add helpful, specific content answering customer questions." },
      { key: "technical", label: "Technical signals", status: hasCanonical && hasViewport ? "pass" : "warning", detail: `${hasCanonical ? "Canonical found" : "Canonical missing"}; ${hasViewport ? "mobile viewport found" : "mobile viewport missing"}`, fix: "Add canonical and viewport tags to prevent indexing and mobile issues." },
      { key: "crawl", label: "Crawler access", status: robotsResponse?.ok && sitemapResponse?.ok ? "pass" : "warning", detail: `${robotsResponse?.ok ? "robots.txt found" : "robots.txt missing"}; ${sitemapResponse?.ok ? "sitemap found" : "sitemap missing"}`, fix: "Publish robots.txt and sitemap.xml so search engines can discover the site." },
    ];
    const score = Math.round((issues.filter((issue) => issue.status === "pass").length / issues.length) * 100);
    return Response.json({ audit: { url: parsed.toString(), checkedAt: new Date().toISOString(), score, title, description, wordCount, issues } });
  } catch (error) {
    console.error("SEO audit failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to audit website" }, { status: 500 });
  }
}
