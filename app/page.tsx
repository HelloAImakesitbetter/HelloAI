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
        <span className="eyebrow">AI GROWTH OPERATING SYSTEM</span>
        <nav className="seo-home-nav"><a href="/website">Website builder</a><a href="/seo">SEO engine</a></nav>
      </header>
      <section className="seo-home-hero">
        <div>
          <span className="eyebrow">BUSINESS GROWTH SYSTEM</span>
          <h1>Build the site, find the demand, win the lead.</h1>
          <p>HelloAI combines an AI website builder, SEO engine, business analyzer, competitor research, and conversion tools in one operating system.</p>
          <div className="seo-home-actions"><a className="primary-button" href="/seo">Start growth analysis →</a><a className="secondary-button" href="/website">Build your website</a></div>
        </div>
        <div className="seo-home-status"><span className="eyebrow">SITE STATUS</span><strong>{connectedSite ? "Connected" : "Ready to connect"}</strong><p>{connectedSite || "No website connected yet"}</p></div>
      </section>
      <section className="seo-home-grid seo-home-grid-five">
        <article><span className="eyebrow">01 / BUILDER</span><h2>Website Builder</h2><p>Generate complete pages, service content, imagery, FAQs, booking paths, and conversion-focused copy.</p><a href="/website">Open builder →</a></article>
        <article><span className="eyebrow">02 / ENGINE</span><h2>SEO Engine</h2><p>Audit every discoverable page, create local opportunities, build content clusters, and automate safe fixes.</p><a href="/seo">Open SEO engine →</a></article>
        <article><span className="eyebrow">03 / INTELLIGENCE</span><h2>Business Analyzer</h2><p>Turn a website crawl into SEO, conversion, trust, missing-page, and growth opportunity scores.</p><a href="/seo">Analyze my business →</a></article>
        <article><span className="eyebrow">04 / RESEARCH</span><h2>Competitor Research</h2><p>Compare competitor gaps, audiences, services, content opportunities, and pages worth building next.</p><a href="/seo">Research competitors →</a></article>
        <article><span className="eyebrow">05 / CONVERSION</span><h2>Lead Generation</h2><p>Build quote, booking, call, WhatsApp, and contact paths so more search traffic becomes real enquiries.</p><a href="/website">Create lead paths →</a></article>
      </section>
    </main>
  );
}