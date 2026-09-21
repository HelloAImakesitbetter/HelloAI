"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [connectedSite, setConnectedSite] = useState("");

  useEffect(() => {
    setConnectedSite(window.localStorage.getItem("helloai-seo-connected-site") || "");
  }, []);

  return (
    <main className="seo-home-shell">
      <header className="seo-home-header">
        <div className="brand-mark"><span>H</span><strong>HelloAI</strong></div>
        <span className="eyebrow">GROWTH WORKSPACE</span>
        <nav className="seo-home-nav"><a href="/website">Website builder</a><a href="/seo">SEO workspace</a></nav>
      </header>
      <section className="seo-home-hero">
        <div>
          <span className="eyebrow">SEARCH VISIBILITY</span>
          <h1>Make every discoverable page work harder.</h1>
          <p>Build and refine your website, connect your publishing platform, and improve search visibility from one focused workspace.</p>
          <div className="seo-home-actions"><a className="primary-button" href="/seo">Open SEO workspace →</a><a className="secondary-button" href="/website">Open website builder</a></div>
        </div>
        <div className="seo-home-status"><span className="eyebrow">SITE STATUS</span><strong>{connectedSite ? "Connected" : "Ready to connect"}</strong><p>{connectedSite || "No website connected yet"}</p></div>
      </section>
      <section className="seo-home-grid">
        <article><span className="eyebrow">01 / BUILD</span><h2>Shape your website</h2><p>Create pages, refine copy, add SEO titles and descriptions, and review the site before publishing.</p><a href="/website">Open builder →</a></article>
        <article><span className="eyebrow">02 / AUDIT</span><h2>Scan the whole site</h2><p>Discover public pages from internal links and nested sitemaps, including pages outside the main navigation.</p><a href="/seo">Run an audit →</a></article>
        <article><span className="eyebrow">03 / IMPROVE</span><h2>Connect publishing</h2><p>Link WordPress, Shopify, Webflow, GitHub/Vercel, or a custom CMS for controlled SEO publishing.</p><a href="/seo">Connect a platform →</a></article>
      </section>
    </main>
  );
}