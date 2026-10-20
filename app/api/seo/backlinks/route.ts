function getTarget(value: string | null) {
  if (!value?.trim()) throw new Error("A website URL is required");
  const url = new URL(value.trim());
  if (!/^https?:$/.test(url.protocol) || ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) throw new Error("Website URL must be a public http(s) website");
  return url.hostname.replace(/^www\./, "");
}

export async function GET(request: Request) {
  try {
    const target = getTarget(new URL(request.url).searchParams.get("siteUrl"));
    if (!process.env.SEMRUSH_API_KEY) return Response.json({ configured: false, target, message: "Add SEMRUSH_API_KEY to enable live backlink data." }, { status: 503 });
    const params = new URLSearchParams({ key: process.env.SEMRUSH_API_KEY, type: "backlinks", target, target_type: "root_domain", export_columns: "source_url,source_title,target_url,anchor,text,follow,nofollow", display_limit: "100" });
    const response = await fetch(`https://www.semrush.com/analytics/ta/api/v3/backlinks?${params}`, { headers: { Accept: "text/plain" }, signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    if (!response.ok || body.startsWith("Error")) throw new Error(body.slice(0, 240) || `Backlink provider returned HTTP ${response.status}`);
    const lines = body.trim().split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() || "").split(";");
    const backlinks = lines.slice(0, 100).map((line) => {
      const values = line.split(";");
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    });
    return Response.json({ configured: true, target, total: backlinks.length, backlinks });
  } catch (error) {
    return Response.json({ configured: false, error: error instanceof Error ? error.message : "Backlink request failed" }, { status: 400 });
  }
}
