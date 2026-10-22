import type { WebsitePage as GeneratedPage } from "./website-generator";

type WebsitePage = Omit<GeneratedPage, "imagePrompt">;

type ExportPhoto = { url: string };

const STYLES = `.hai{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#17221b;line-height:1.6;max-width:1100px;margin:0 auto;padding:24px}
.hai *{box-sizing:border-box}.hai nav{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #e2e8e3}
.hai nav a{color:#17221b;text-decoration:none;margin-left:14px}.hai h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.1;margin:.3em 0}
.hai h2{margin-top:2em}.hai .hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px;align-items:center;padding:32px 0}
.hai .hero img{width:100%;height:auto;border-radius:14px}.hai .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.hai .cards article{padding:20px;border:1px solid #e2e8e3;border-radius:10px;background:#f8faf7}.hai .split{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
.hai .cta{display:inline-block;background:#17221b;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;margin:8px 8px 0 0}
.hai .cta.alt{background:#fff;color:#17221b;border:1px solid #17221b}`;

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function list(items: string[], tag: "ul" | "ol" = "ul") {
  return items.length ? `<${tag}>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</${tag}>` : "";
}

export function pageFileName(page: WebsitePage) {
  return page.slug === "home" ? "index.html" : `${page.slug}.html`;
}

function body(page: WebsitePage, businessName: string, pages: WebsitePage[], heroUrl: string | undefined, linkNav: boolean) {
  const nav = linkNav
    ? `<nav><strong>${esc(businessName || page.title)}</strong><span>${pages.filter((p) => p.showInNavigation !== false).map((p) => `<a href="${pageFileName(p)}">${esc(p.label)}</a>`).join("")}</span></nav>`
    : "";
  const sections = (page.sections || []).map((section) => {
    const inner = section.layout === "cards"
      ? `<div class="cards">${section.items.map((item) => `<article><p>${esc(item)}</p></article>`).join("")}</div>`
      : section.layout === "split"
        ? `<div class="split"><p>${esc(section.body)}</p>${list(section.items)}</div>`
        : section.layout === "steps" ? list(section.items, "ol") : list(section.items);
    return `<section><h2>${esc(section.heading)}</h2>${section.layout !== "split" && section.body ? `<p>${esc(section.body)}</p>` : ""}${inner}</section>`;
  }).join("");
  return `<div class="hai">${nav}<header class="hero"><div><h1>${esc(page.title)}</h1><p>${esc(page.tagline)}</p><p>${esc(page.intro)}</p>${page.primaryCta ? `<a class="cta" href="#contact">${esc(page.primaryCta)}</a>` : ""}${page.secondaryCta ? `<a class="cta alt" href="#contact">${esc(page.secondaryCta)}</a>` : ""}</div>${heroUrl ? `<img src="${esc(heroUrl)}" alt="${esc(page.label)}" />` : ""}</header>${page.benefits.length ? `<h2>Benefits</h2>${list(page.benefits)}` : ""}${page.steps.length ? `<h2>How it works</h2>${list(page.steps, "ol")}` : ""}${sections}<h2 id="contact">${esc(page.closing)}</h2></div>`;
}

export function exportPageHtml(page: WebsitePage, businessName: string, pages: WebsitePage[], photos: Record<string, ExportPhoto[]>) {
  const hero = photos[page.slug]?.[0]?.url;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.seoTitle || page.title)}</title><meta name="description" content="${esc(page.seoDescription || "")}"><style>body{margin:0}${STYLES}</style></head><body>${body(page, businessName, pages, hero, true)}</body></html>`;
}

// A paste-ready fragment (scoped styles, no html/head) for Wix "Embed HTML", Squarespace code blocks, etc.
export function exportEmbedHtml(page: WebsitePage, businessName: string, photos: Record<string, ExportPhoto[]>) {
  const hero = photos[page.slug]?.[0]?.url;
  return `<style>${STYLES}</style>${body(page, businessName, [], hero, false)}`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Minimal uncompressed ZIP so the whole site downloads as one file without extra dependencies.
export function buildZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true); entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}
