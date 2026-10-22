import { exportEmbedHtml, exportPageHtml, pageFileName } from "../../../../lib/website-export";
import { rateLimit } from "../../../../lib/rate-limit";

type Page = Parameters<typeof exportPageHtml>[0];

function str(value: unknown, label: string, max: number, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${label} is required`);
  if (result.length > max) throw new Error(`${label} is too long`);
  return result;
}

function parsePage(value: unknown): Page {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A reviewed website page is required");
  const raw = value as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 8).map((item) => str(item, "List item", 500, false)) : []);
  const slug = str(raw.slug, "Page slug", 160).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  if (!slug) throw new Error("Page slug must contain letters or numbers");
  const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, 8).flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const s = section as Record<string, unknown>;
    const layout = (["cards", "split", "faq", "steps"].includes(s.layout as string) ? s.layout : "cards") as "cards" | "split" | "faq" | "steps";
    return [{ heading: str(s.heading, "Section heading", 200, false), body: str(s.body, "Section body", 3000, false), items: list(s.items), layout }];
  }) : [];
  return {
    slug,
    label: str(raw.label, "Page label", 100, false),
    title: str(raw.title, "Page title", 200),
    tagline: str(raw.tagline, "Tagline", 1000, false),
    intro: str(raw.intro, "Introduction", 5000),
    primaryCta: str(raw.primaryCta, "Primary CTA", 200, false),
    secondaryCta: str(raw.secondaryCta, "Secondary CTA", 200, false),
    benefits: list(raw.benefits),
    steps: list(raw.steps),
    closing: str(raw.closing, "Closing", 500, false),
    seoTitle: str(raw.seoTitle, "SEO title", 200, false),
    seoDescription: str(raw.seoDescription, "SEO description", 500, false),
    sections,
    showInNavigation: raw.showInNavigation !== false,
  };
}

async function callJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || `Provider returned HTTP ${response.status}`);
  return data as Record<string, unknown>;
}

function remoteHero(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "images.unsplash.com" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function publishShopify(body: Record<string, unknown>, page: Page, businessName: string, hero: string | undefined) {
  const shop = str(body.shopDomain, "Shopify store domain", 200).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Use your store's .myshopify.com domain");
  const token = str(body.token, "Shopify access token", 4096);
  const html = exportEmbedHtml(page, businessName, hero ? { [page.slug]: [{ url: hero }] } : {});
  const data = await callJson(`https://${shop}/admin/api/2025-01/pages.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ page: { title: page.title, handle: page.slug, body_html: html, published: false } }),
  });
  const created = data.page as { id?: number } | undefined;
  return { message: "Created as an unpublished Shopify page.", url: created?.id ? `https://${shop}/admin/pages/${created.id}` : `https://${shop}/admin/pages` };
}

async function publishGitHub(body: Record<string, unknown>, page: Page, businessName: string, heroValue: unknown) {
  const repository = str(body.repository, "Repository", 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Repository must look like owner/name");
  const token = str(body.token, "GitHub token", 4096);
  const branch = str(body.branch, "Branch", 100, false) || "helloai-pages";
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..")) throw new Error("Invalid branch name");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "HelloAI", "Content-Type": "application/json" };
  const api = `https://api.github.com/repos/${repository}`;

  const repo = await callJson(api, { headers });
  const defaultBranch = String(repo.default_branch || "main");
  // Commit to a separate branch so nothing goes live until the user merges.
  const branchRef = await fetch(`${api}/git/ref/heads/${branch}`, { headers, signal: AbortSignal.timeout(20000) });
  if (branchRef.status === 404) {
    const base = await callJson(`${api}/git/ref/heads/${defaultBranch}`, { headers });
    await callJson(`${api}/git/refs`, { method: "POST", headers, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: (base.object as { sha: string }).sha }) });
  } else if (!branchRef.ok) {
    throw new Error(`GitHub returned HTTP ${branchRef.status}`);
  }

  const put = async (path: string, content: string, encoding: "utf8" | "base64") => {
    const existing = await fetch(`${api}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers, signal: AbortSignal.timeout(20000) });
    const sha = existing.ok ? ((await existing.json()) as { sha?: string }).sha : undefined;
    await callJson(`${api}/contents/${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: `Add ${path} from HelloAI`, branch, sha, content: encoding === "utf8" ? Buffer.from(content).toString("base64") : content }),
    });
  };

  let heroUrl: string | undefined = remoteHero(heroValue);
  if (typeof heroValue === "string") {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(heroValue);
    if (match) {
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      await put(`images/${page.slug}.${ext}`, match[2], "base64");
      heroUrl = `images/${page.slug}.${ext}`;
    }
  }
  const fileName = pageFileName(page);
  await put(fileName, exportPageHtml(page, businessName, [page], heroUrl ? { [page.slug]: [{ url: heroUrl }] } : {}), "utf8");
  return { message: `Committed ${fileName} to branch "${branch}". Merge it when you're ready to go live.`, url: `https://github.com/${repository}/tree/${encodeURIComponent(branch)}` };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  const limited = rateLimit(request, "website-publish-provider", 30, 10 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await request.json() as Record<string, unknown>;
    const page = parsePage(body.page);
    const businessName = str(body.businessName, "Business name", 200, false);
    const provider = body.provider;
    if (provider === "shopify") return Response.json(await publishShopify(body, page, businessName, remoteHero(body.heroImage)));
    if (provider === "github-vercel") return Response.json(await publishGitHub(body, page, businessName, body.heroImage));
    return Response.json({ error: "This provider does not support direct publishing. Use the download or embed options." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Publishing failed" }, { status: 400 });
  }
}
