type Provider =
  | "wordpress"
  | "shopify"
  | "webflow"
  | "github-vercel"
  | "custom"
  | "google-search-console"
  | "google-analytics"
  | "google-business-profile"
  | "whatsapp";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function required(value: string, label: string) {
  if (!value) throw new Error(`${label} is required`);
}

async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error?.message || `Provider returned HTTP ${response.status}`);
  }
  return body;
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function whatsappConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const provider = text(body.provider) as Provider;
    const token = text(body.token);

    required(provider, "Provider");

    if (provider === "wordpress") {
      const baseUrl = text(body.baseUrl).replace(/\/$/, "");
      required(baseUrl, "WordPress URL");
      required(token, "Access token");
      await requestJson(`${baseUrl}/wp-json/wp/v2/users/me?context=edit`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      return Response.json({
        connected: true,
        provider,
        label: "WordPress",
        detail: "WordPress credentials verified. Publishing will update page metadata through the REST API.",
      });
    }

    if (provider === "shopify") {
      const shopDomain = text(body.shopDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
      required(shopDomain, "Shopify store domain");
      required(token, "Access token");
      const shop = await requestJson(`https://${shopDomain}/admin/api/2025-01/shop.json`, {
        headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
      });
      return Response.json({
        connected: true,
        provider,
        label: "Shopify",
        detail: `Connected to ${shop?.shop?.name || shopDomain}. Publishing will update supported online-store metadata.`,
      });
    }

    if (provider === "webflow") {
      const siteId = text(body.siteId);
      required(siteId, "Webflow site ID");
      required(token, "Access token");
      const site = await requestJson(`https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      return Response.json({
        connected: true,
        provider,
        label: "Webflow",
        detail: `Connected to ${site?.displayName || siteId}. Publishing will use the Webflow site API.`,
      });
    }

    if (provider === "github-vercel") {
      const repository = text(body.repository);
      const vercelProject = text(body.vercelProject);
      required(repository, "GitHub repository");
      required(vercelProject, "Vercel project");
      required(token, "Access token");
      const user = await requestJson("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "HelloAI" },
      });
      return Response.json({
        connected: true,
        provider,
        label: "GitHub / Vercel",
        detail: `GitHub account ${user?.login || "verified"} connected for ${repository}; Vercel project ${vercelProject} is ready for deployment configuration.`,
      });
    }

    if (provider === "custom") {
      const endpoint = text(body.endpoint);
      required(endpoint, "Custom CMS endpoint");
      required(token, "Access token");
      await requestJson(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      return Response.json({
        connected: true,
        provider,
        label: "Custom CMS",
        detail: "Custom CMS endpoint verified. Publishing requires the endpoint to accept HelloAI SEO patch payloads.",
      });
    }

    if (provider === "google-search-console" || provider === "google-analytics" || provider === "google-business-profile") {
      if (!googleConfigured()) {
        throw new Error("Google OAuth credentials are not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the environment before connecting Google services.");
      }
      required(token, "Access token");
      const info = await requestJson(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`);
      const email = text(body.accountEmail) || info?.email || "account";
      const labelMap: Record<string, string> = {
        "google-search-console": "Google Search Console",
        "google-analytics": "Google Analytics",
        "google-business-profile": "Google Business Profile",
      };
      return Response.json({
        connected: true,
        provider,
        label: labelMap[provider],
        detail: `${labelMap[provider]} token validated for ${email}. Connect the provider account in your environment to enable live reporting.`,
      });
    }

    if (provider === "whatsapp") {
      if (!whatsappConfigured()) {
        throw new Error("WhatsApp credentials are not configured yet. Add META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, and WHATSAPP_PHONE_NUMBER_ID to the environment.");
      }
      required(token, "Access token");
      const info = await requestJson(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
      return Response.json({
        connected: true,
        provider,
        label: "WhatsApp",
        detail: `WhatsApp access token validated for business account ${info?.id || "verified"}. Webhook and message flows are ready for deployment.`,
      });
    }

    throw new Error("Unsupported provider");
  } catch (error) {
    return Response.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 400 }
    );
  }
}
