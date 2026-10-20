const providerNames = {
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
  "github-vercel": "GitHub / Vercel",
  custom: "Custom CMS",
  "google-search-console": "Google Search Console",
  "google-analytics": "Google Analytics",
  "google-business-profile": "Google Business Profile",
  whatsapp: "WhatsApp",
} as const;

export async function GET() {
  const providers = Object.entries(providerNames).map(([id, label]) => {
    const isConfigured = (() => {
      switch (id) {
        case "wordpress": return Boolean(process.env.WORDPRESS_BASE_URL);
        case "shopify": return Boolean(process.env.SHOPIFY_STORE_DOMAIN);
        case "webflow": return Boolean(process.env.WEBFLOW_SITE_ID);
        case "github-vercel": return Boolean(process.env.GITHUB_REPOSITORY && process.env.VERCEL_PROJECT_NAME);
        case "custom": return Boolean(process.env.CUSTOM_CMS_ENDPOINT);
        case "google-search-console": return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        case "google-analytics": return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        case "google-business-profile": return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        case "whatsapp": return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
        default: return false;
      }
    })();

    return {
      id,
      label,
      configured: isConfigured,
      status: isConfigured ? "ready" : "missing-config",
    };
  });

  return Response.json({ providers });
}
