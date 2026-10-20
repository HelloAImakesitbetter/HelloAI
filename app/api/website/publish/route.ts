import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type WordPressPage = {
  slug: string;
  label: string;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  seoDescription: string;
};

function text(value: unknown, label: string, maximum: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new Error(`${label} is required`);
    return "";
  }

  const result = value.trim();
  if (required && !result) throw new Error(`${label} is required`);
  if (result.length > maximum) throw new Error(`${label} is too long`);
  return result;
}

function textList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > 8) throw new Error(`${label} must contain no more than 8 items`);
  return value.map((item) => text(item, label, 500, true));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [first, second, third] = address.split(".").map(Number);
    return !(
      first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 0 || second === 168)) ||
      (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
      (first === 203 && second === 0 && third === 113)
    );
  }

  const normalized = address.toLowerCase();
  return /^[23][0-9a-f]{3}:/.test(normalized) && !normalized.startsWith("2001:db8:");
}

async function validateWordPressUrl(value: unknown) {
  const rawUrl = text(value, "WordPress URL", 2048, true);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid WordPress URL");
  }

  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("WordPress must use a public HTTPS URL without credentials, query parameters, or a fragment");
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("WordPress URL must use a public website hostname");
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("WordPress URL must resolve only to public IP addresses");
  }

  return url;
}

function makeContent(page: WordPressPage, businessName: string) {
  const businessHeading = businessName ? `<p>${escapeHtml(businessName)}</p>` : "";
  const benefits = page.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = page.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return [
    `<h1>${escapeHtml(page.title)}</h1>`,
    businessHeading,
    `<p>${escapeHtml(page.tagline)}</p>`,
    `<p>${escapeHtml(page.intro)}</p>`,
    benefits ? `<h2>Benefits</h2><ul>${benefits}</ul>` : "",
    steps ? `<h2>How it works</h2><ol>${steps}</ol>` : "",
    `<h2>${escapeHtml(page.closing)}</h2>`,
    `<p>${escapeHtml(page.primaryCta)}${page.secondaryCta ? ` · ${escapeHtml(page.secondaryCta)}` : ""}</p>`,
  ].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin publishing requests are not allowed" }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const token = text(body.token, "WordPress access token", 4096, true);
    const username = text(body.username, "WordPress username", 200);
    const pageData = body.page;
    if (!pageData || typeof pageData !== "object" || Array.isArray(pageData)) {
      return Response.json({ error: "A reviewed website page is required" }, { status: 400 });
    }

    const rawPage = pageData as Record<string, unknown>;
    const slug = text(rawPage.slug, "Page slug", 160, true)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    if (!slug) return Response.json({ error: "Page slug must contain letters or numbers" }, { status: 400 });

    const page: WordPressPage = {
      slug,
      label: text(rawPage.label, "Page label", 100),
      title: text(rawPage.title, "Page title", 200, true),
      tagline: text(rawPage.tagline, "Page tagline", 1000),
      intro: text(rawPage.intro, "Page introduction", 5000, true),
      primaryCta: text(rawPage.primaryCta, "Primary call to action", 200),
      secondaryCta: text(rawPage.secondaryCta, "Secondary call to action", 200),
      benefits: textList(rawPage.benefits, "Benefits"),
      steps: textList(rawPage.steps, "Steps"),
      closing: text(rawPage.closing, "Closing text", 1000),
      seoDescription: text(rawPage.seoDescription, "SEO description", 500),
    };
    const businessName = text(body.businessName, "Business name", 160);
    const siteUrl = await validateWordPressUrl(body.baseUrl);
    const endpoint = `${siteUrl.origin}${siteUrl.pathname.replace(/\/$/, "")}/wp-json/wp/v2/pages`;
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: username
          ? `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`
          : `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: page.title,
        slug: page.slug,
        content: makeContent(page, businessName),
        excerpt: page.seoDescription,
        status: "draft",
      }),
    });

    if (response.status >= 300 && response.status < 400) {
      return Response.json({ error: "WordPress redirected the publishing request. Check the site URL and try again." }, { status: 502 });
    }

    const result = await response.json().catch(() => ({})) as { id?: number; message?: string };
    if (!response.ok || !Number.isInteger(result.id)) {
      return Response.json({ error: result.message?.slice(0, 300) || `WordPress rejected the draft (HTTP ${response.status})` }, { status: 502 });
    }

    const editUrl = new URL("wp-admin/post.php", `${siteUrl.origin}${siteUrl.pathname.replace(/\/$/, "")}/`);
    editUrl.searchParams.set("post", String(result.id));
    editUrl.searchParams.set("action", "edit");

    return Response.json({ id: result.id, status: "draft", editUrl: editUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create WordPress draft";
    const invalidRequest = error instanceof SyntaxError || ["required", "too long", "valid", "public", "HTTPS", "must"].some((term) => message.includes(term));
    const status = invalidRequest ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}