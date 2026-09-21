type AuditIssue = {
  key: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  fix: string;
};
type AuditedPage = {
  url: string;
  title: string;
  description: string;
  wordCount: number;
  score: number;
  issues: AuditIssue[];
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

function extractLinks(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        const link = new URL(match[1], base);
        link.hash = "";
        if (link.origin !== base.origin || !/^https?:$/.test(link.protocol)) return null;
        return link.toString();
      } catch {
        return null;
      }
    })
    .filter((link): link is string => Boolean(link));
}

function extractSitemapLinks(xml: string, base: URL) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => {
      try {
        const link = new URL(match[1], base);
        return link.origin === base.origin && /^https?:$/.test(link.protocol) ? link.toString() : null;
      } catch {
        return null;
      }
    })
    .filter((link): link is string => Boolean(link));
}

async function collectSitemapPages(sitemapUrl: string, base: URL, visited: Set<string>, pages: Set<string>) {
  if (visited.has(sitemapUrl) || visited.size >= 20) return;
  visited.add(sitemapUrl);
  try {
    const response = await fetch(sitemapUrl, { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const xml = await response.text();
    for (const link of extractSitemapLinks(xml, base)) {
      if (/\.xml(?:$|\?)/i.test(new URL(link).pathname)) await collectSitemapPages(link, base, visited, pages);
      else pages.add(link);
    }
  } catch {
    // A broken nested sitemap should not prevent other pages from being audited.
  }
}

function analyzePage(html: string, url: string, robotsOk: boolean, sitemapOk: boolean): AuditedPage {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
  const imageCount = countMatches(html, /<img\b[^>]*>/gi);
  const missingAltCount = [...html.matchAll(/<img\b([^>]*)>/gi)].filter((match) => !/\balt\s*=\s*["'][^"']*["']/i.test(match[1])).length;
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  const issues: AuditIssue[] = [
    { key: "title", label: "Page title", status: title.length >= 30 && title.length <= 60 ? "pass" : title ? "warning" : "fail", detail: title ? `${title.length} characters` : "No title found", fix: "Write a specific title with the service and location." },
    { key: "description", label: "Meta description", status: description.length >= 120 && description.length <= 160 ? "pass" : description ? "warning" : "fail", detail: description ? `${description.length} characters` : "No meta description found", fix: "Add a useful 120-160 character description with a clear benefit." },
    { key: "h1", label: "Single main heading", status: h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warning", detail: `${h1Count} H1 headings found`, fix: "Use one clear H1 that matches the page's main search intent." },
    { key: "images", label: "Image accessibility", status: imageCount === 0 || missingAltCount === 0 ? "pass" : "warning", detail: imageCount ? `${missingAltCount} of ${imageCount} images need alt text` : "No images found", fix: "Add descriptive alt text that explains the image's purpose." },
    { key: "content", label: "Useful page content", status: wordCount >= 300 ? "pass" : "warning", detail: `${wordCount} readable words found`, fix: "Add helpful, specific content answering customer questions." },
    { key: "technical", label: "Technical signals", status: hasCanonical && hasViewport ? "pass" : "warning", detail: `${hasCanonical ? "Canonical found" : "Canonical missing"}; ${hasViewport ? "mobile viewport found" : "mobile viewport missing"}`, fix: "Add canonical and viewport tags to prevent indexing and mobile issues." },
    { key: "crawl", label: "Crawler access", status: robotsOk && sitemapOk ? "pass" : "warning", detail: `${robotsOk ? "robots.txt found" : "robots.txt missing"}; ${sitemapOk ? "sitemap found" : "sitemap missing"}`, fix: "Publish robots.txt and sitemap.xml so search engines can discover the site." },
  ];
  return { url, title, description, wordCount, score: Math.round((issues.filter((issue) => issue.status === "pass").length / issues.length) * 100), issues };
}

export async function POST(req: Request) {
  try {
    const { websiteUrl } = (await req.json()) as { websiteUrl?: string };
    if (!websiteUrl?.trim()) return Response.json({ error: "A website URL is required" }, { status: 400 });
    const parsed = getHost(websiteUrl.trim());
    const robotsResponse = await fetch(new URL("/robots.txt", parsed.origin), { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    const sitemapResponse = await fetch(new URL("/sitemap.xml", parsed.origin), { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    const robotsOk = Boolean(robotsResponse?.ok);
    const sitemapOk = Boolean(sitemapResponse?.ok);
    const seedUrls = new Set<string>([parsed.toString()]);
    if (sitemapResponse?.ok) {
      const sitemapXml = await sitemapResponse.text();
      const sitemapPages = new Set<string>();
      const nestedSitemaps = new Set<string>();
      extractSitemapLinks(sitemapXml, parsed).forEach((url) => /\.xml(?:$|\?)/i.test(new URL(url).pathname) ? nestedSitemaps.add(url) : sitemapPages.add(url));
      for (const sitemapUrl of nestedSitemaps) await collectSitemapPages(sitemapUrl, parsed, new Set<string>(), sitemapPages);
      sitemapPages.forEach((url) => seedUrls.add(url));
    }

    const queue = [...seedUrls];
    const discovered = new Set<string>();
    const pages: AuditedPage[] = [];
    while (queue.length && pages.length < 500) {
      const url = queue.shift() as string;
      if (discovered.has(url)) continue;
      discovered.add(url);
      try {
        const pageResponse = await fetch(url, { headers: { "User-Agent": "HelloAI SEO Auditor/1.0" }, signal: AbortSignal.timeout(12000) });
        if (!pageResponse.ok || !pageResponse.headers.get("content-type")?.includes("text/html")) continue;
        const html = (await pageResponse.text()).slice(0, 2_000_000);
        pages.push(analyzePage(html, url, robotsOk, sitemapOk));
        extractLinks(html, new URL(url)).forEach((link) => {
          if (!discovered.has(link)) queue.push(link);
        });
      } catch {
        // Continue crawling when an individual page is unavailable.
      }
    }
    if (!pages.length) throw new Error("No HTML pages could be found on this website");
    const issues = [...new Set(pages.flatMap((page) => page.issues.map((issue) => issue.key)))].map((key) => {
      const matching = pages.flatMap((page) => page.issues).filter((issue) => issue.key === key);
      const status = matching.some((issue) => issue.status === "fail") ? "fail" : matching.some((issue) => issue.status === "warning") ? "warning" : "pass";
      const example = matching.find((issue) => issue.status === status) || matching[0];
      return { ...example, status, detail: `${matching.filter((issue) => issue.status !== "pass").length} of ${pages.length} pages need attention` };
    });
    const score = Math.round(pages.reduce((total, page) => total + page.score, 0) / pages.length);
    return Response.json({ audit: { url: parsed.toString(), checkedAt: new Date().toISOString(), score, title: pages[0].title, description: pages[0].description, wordCount: pages.reduce((total, page) => total + page.wordCount, 0), pages, pagesFound: discovered.size, pagesChecked: pages.length, issues } });
  } catch (error) {
    console.error("SEO audit failed:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to audit website" }, { status: 500 });
  }
}
