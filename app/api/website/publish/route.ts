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
  sections: { heading: string; body: string; items: string[]; layout: "cards" | "split" | "faq" | "steps" }[];
};

type PreparedHeroImage = { data: Buffer; contentType: string } | { url: string } | null;

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

function parseHeroImage(value: unknown): PreparedHeroImage {
  if (value === undefined || value === null || value === "") return null;
  const image = text(value, "Hero image", 12_000_000, true);
  if (image.startsWith("data:")) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match) throw new Error("Hero image must be a JPEG, PNG, or WebP image");
    const contentType = match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`;
    const data = Buffer.from(match[2], "base64");
    const validSignature = contentType === "image/jpeg"
      ? data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      : contentType === "image/png"
        ? data.length > 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    if (!validSignature) throw new Error("Hero image has an invalid image file signature");
    if (data.length > 8 * 1024 * 1024) throw new Error("Hero image must be smaller than 8 MB");
    return { data, contentType };
  }

  let url: URL;
  try {
    url = new URL(image);
  } catch {
    throw new Error("Hero image URL is invalid");
  }
  if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com" || url.username || url.password) {
    throw new Error("Hero image must use a trusted HTTPS image URL");
  }
  return { url: url.toString() };
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

function makeContent(page: WordPressPage, businessName: string, heroImageUrl: string | null) {
  const businessHeading = businessName ? `<p>${escapeHtml(businessName)}</p>` : "";
  const benefits = page.benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = page.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const sections = page.sections.map((section) => {
    const items = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const content = section.layout === "cards"
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">${section.items.map((item) => `<article style="padding:20px;border:1px solid #e2e8e3;border-radius:10px;background:#f8faf7"><p>${escapeHtml(item)}</p></article>`).join("")}</div>`
      : section.layout === "split"
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px"><p>${escapeHtml(section.body)}</p><ul>${items}</ul></div>`
        : section.layout === "steps" ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    return `<section class="helloai-page-section helloai-layout-${section.layout}"><h2>${escapeHtml(section.heading)}</h2>${section.layout === "split" ? "" : section.body ? `<p>${escapeHtml(section.body)}</p>` : ""}${content}</section>`;
  }).join("\n");

  return [
    heroImageUrl ? `<figure class="wp-block-image size-large"><img src="${escapeHtml(heroImageUrl)}" alt="${escapeHtml(page.label)}" style="width:100%;height:auto" /></figure>` : "",
    `<h1>${escapeHtml(page.title)}</h1>`,
    businessHeading,
    `<p>${escapeHtml(page.tagline)}</p>`,
    `<p>${escapeHtml(page.intro)}</p>`,
    benefits ? `<h2>Benefits</h2><ul>${benefits}</ul>` : "",
    steps ? `<h2>How it works</h2><ol>${steps}</ol>` : "",
    sections,
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
    const username = text(body.username, "WordPress username", 200, true);
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
      sections: Array.isArray(rawPage.sections) ? rawPage.sections.slice(0, 8).map((section) => {
        if (!section || typeof section !== "object" || Array.isArray(section)) throw new Error("Page section is invalid");
        const rawSection = section as Record<string, unknown>;
        const layout = text(rawSection.layout, "Section layout", 20, true);
        if (!["cards", "split", "faq", "steps"].includes(layout)) throw new Error("Section layout is invalid");
        return {
          heading: text(rawSection.heading, "Section heading", 200, true),
          body: text(rawSection.body, "Section body", 3000),
          items: textList(rawSection.items, "Section items"),
          layout: layout as WordPressPage["sections"][number]["layout"],
        };
      }) : [],
    };
    if (Array.isArray(rawPage.sections) && rawPage.sections.length > 8) throw new Error("Page has too many sections");
    const businessName = text(body.businessName, "Business name", 160);
    const heroImage = parseHeroImage(body.heroImage);
    const siteUrl = await validateWordPressUrl(body.baseUrl);
    const siteRoot = `${siteUrl.origin}${siteUrl.pathname.replace(/\/$/, "")}`;
    const endpoint = `${siteRoot}/wp-json/wp/v2/pages`;
    let heroImageUrl: string | null = null;
    let heroMediaId: number | undefined;

    if (heroImage && "data" in heroImage) {
      const extension = heroImage.contentType === "image/jpeg" ? "jpg" : heroImage.contentType.split("/")[1];
      const mediaResponse = await fetch(`${siteRoot}/wp-json/wp/v2/media`, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
          Accept: "application/json",
          "Content-Type": heroImage.contentType,
          "Content-Disposition": `attachment; filename="${slug}-hero.${extension}"`,
        },
        body: Uint8Array.from(heroImage.data).buffer,
      });
      if (mediaResponse.status >= 300 && mediaResponse.status < 400) {
        return Response.json({ error: "WordPress redirected the image upload. Check the site URL and try again." }, { status: 502 });
      }
      const media = await mediaResponse.json().catch(() => ({})) as { id?: number; source_url?: string; message?: string };
      if (!mediaResponse.ok || !Number.isInteger(media.id) || !media.source_url) {
        return Response.json({ error: media.message?.slice(0, 300) || `WordPress rejected the hero image (HTTP ${mediaResponse.status})` }, { status: 502 });
      }
      heroMediaId = media.id;
      heroImageUrl = media.source_url;
    } else if (heroImage && "url" in heroImage) {
      heroImageUrl = heroImage.url;
    }

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
        content: makeContent(page, businessName, heroImageUrl),
        excerpt: page.seoDescription,
        status: "draft",
        ...(heroMediaId ? { featured_media: heroMediaId } : {}),
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