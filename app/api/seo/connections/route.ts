type Provider = "wordpress" | "shopify" | "webflow" | "github-vercel" | "custom";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function required(value: string, label: string) {
  if (!value) throw new Error(`${label} is required`);
}

async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || body?.error?.message || `Provider returned HTTP ${response.status}`);
  return body;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const provider = text(body.provider) as Provider;
    const token = text(body.token);
    required(provider, "Provider");
    required(token, "Access token");

    let label = "";
    let detail = "";
    if (provider === "wordpress") {
      const baseUrl = text(body.baseUrl).replace(/\/$/, "");
      required(baseUrl, "WordPress URL");
      await requestJson(`${baseUrl}/wp-json/wp/v2/users/me?context=edit`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      label = "WordPress";
      detail = "WordPress credentials verified. Publishing will update page metadata through the REST API.";
    } else if (provider === "shopify") {
      const shopDomain = text(body.shopDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
      required(shopDomain, "Shopify store domain");
      const shop = await requestJson(`https://${shopDomain}/admin/api/2025-01/shop.json`, { headers: { "X-Shopify-Access-Token": token, Accept: "application/json" } });
      label = "Shopify";
      detail = `Connected to ${shop?.shop?.name || shopDomain}. Publishing will update supported online-store metadata.`;
    } else if (provider === "webflow") {
      const siteId = text(body.siteId);
      required(siteId, "Webflow site ID");
      const site = await requestJson(`https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      label = "Webflow";
      detail = `Connected to ${site?.displayName || siteId}. Publishing will use the Webflow site API.`;
    } else if (provider === "github-vercel") {
      const repository = text(body.repository);
      const vercelProject = text(body.vercelProject);
      required(repository, "GitHub repository");
      required(vercelProject, "Vercel project");
      const user = await requestJson("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "HelloAI SEO" } });
      label = "GitHub / Vercel";
      detail = `GitHub account ${user?.login || "verified"} connected for ${repository}; Vercel project ${vercelProject} is ready for deployment configuration.`;
    } else if (provider === "custom") {
      const endpoint = text(body.endpoint);
      required(endpoint, "Custom CMS endpoint");
      await requestJson(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      label = "Custom CMS";
      detail = "Custom CMS endpoint verified. Publishing requires the endpoint to accept HelloAI SEO patch payloads.";
    } else {
      throw new Error("Unsupported publishing provider");
    }

    return Response.json({ connected: true, provider, label, detail });
  } catch (error) {
    return Response.json({ connected: false, error: error instanceof Error ? error.message : "Connection failed" }, { status: 400 });
  }
}
