"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [connectedSite, setConnectedSite] = useState("");
  const [businessName, setBusinessName] = useState("Your growth workspace");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    setConnectedSite(window.localStorage.getItem("helloai-seo-connected-site") || "");
    const saved = window.localStorage.getItem("helloai-website-draft");
    if (!saved) return;
    try {
      const project = JSON.parse(saved) as { businessName?: string; draft?: { pages?: unknown[] } };
      setBusinessName(project.businessName || "Your growth workspace");
      setPageCount(project.draft?.pages?.length || 0);
    } catch { /* Ignore stale browser data. */ }
  }, []);

  return (
    <main className="workbench-shell">
      <aside className="workbench-sidebar">
        <div className="brand-mark"><span>H</span><strong>HelloAI</strong></div>
        <a className="workbench-new" href="/website">+ New website project</a>
        <span className="workbench-label">Workspace</span>
        <nav className="workbench-nav"><a className="active" href="/">Overview</a><a href="/website">Website builder</a><a href="/seo">SEO engine</a><a href="/seo">Business analyzer</a><a href="/seo">Competitor research</a><a href="/website">Lead generation</a></nav>
        <div className="workbench-sidebar-footer"><span className="status-dot">●</span><span>{connectedSite ? "Site connected" : "Ready to connect"}</span></div>
      </aside>

      <section className="workbench-main">
        <header className="workbench-header"><div><span className="eyebrow">OVERVIEW / TODAY</span><h1>Good morning.</h1><p>Here is the clearest next move for {businessName.toLowerCase()}.</p></div><div className="workbench-header-actions"><a href="/seo" className="secondary-button">Run analysis</a><a href="/website" className="primary-button">Build website →</a></div></header>

        <section className="workbench-project-bar"><div><span className="eyebrow">ACTIVE PROJECT</span><strong>{businessName}</strong><small>{connectedSite || "Connect a website to unlock the full growth map"}</small></div><div className="workbench-project-meta"><span>{pageCount || "0"} pages</span><span>{connectedSite ? "Connected" : "Not connected"}</span></div></section>

        <section className="workbench-grid">
          <div className="workbench-primary"><div className="workbench-section-heading"><div><span className="eyebrow">NEXT BEST ACTION</span><h2>Turn your brief into a complete growth system.</h2></div><span className="workbench-spark">✦</span></div><p className="workbench-lead">Start with the website builder, then run a full crawl. HelloAI will connect your pages, search opportunities, competitors, and lead paths into one prioritized plan.</p><div className="workbench-actions"><a href="/website"><b>01</b><span><strong>Build the website</strong><small>Pages, service content, imagery, FAQs, and booking paths.</small></span><i>→</i></a><a href="/seo"><b>02</b><span><strong>Find the opportunities</strong><small>Audit every discoverable page and map what to build next.</small></span><i>→</i></a><a href="/seo"><b>03</b><span><strong>Connect the growth engine</strong><small>Link your platform and approve safe SEO improvements.</small></span><i>→</i></a></div></div>
          <aside className="workbench-health"><div className="workbench-section-heading"><div><span className="eyebrow">GROWTH HEALTH</span><h2>{connectedSite ? "Ready to improve" : "Not measured yet"}</h2></div><span className="health-ring">{connectedSite ? "--" : "—"}</span></div><div className="health-list"><p><span>Website foundation</span><b>{pageCount ? "In progress" : "Not started"}</b></p><p><span>Search visibility</span><b>{connectedSite ? "Ready to scan" : "Awaiting site"}</b></p><p><span>Lead capture</span><b>Available</b></p></div><a href="/seo" className="text-link">Open growth map →</a></aside>
        </section>

        <section className="workbench-lower"><div className="workbench-feed"><div className="workbench-section-heading"><div><span className="eyebrow">ACTIVITY</span><h2>Project momentum</h2></div></div><div className="feed-item"><span>01</span><div><strong>Website builder</strong><p>{pageCount ? `${pageCount} pages are ready for review.` : "Your site map is waiting for a business brief."}</p></div><a href="/website">Open</a></div><div className="feed-item"><span>02</span><div><strong>SEO engine</strong><p>{connectedSite ? "Your connected site can be audited across all discoverable pages." : "Connect a public site to reveal missing pages and keyword opportunities."}</p></div><a href="/seo">Open</a></div><div className="feed-item"><span>03</span><div><strong>Live agent</strong><p>Ask HelloAI which action will create the most value next.</p></div><button type="button" onClick={() => window.dispatchEvent(new Event("helloai:open-agent"))}>Ask</button></div></div><div className="workbench-quote"><span className="eyebrow">THE HELLOAI METHOD</span><blockquote>“Do not just tell me what is wrong. Show me what to build next, and help me ship it.”</blockquote><p>One workspace for the site, the demand, and the lead.</p></div></section>
      </section>
    </main>
  );
}
