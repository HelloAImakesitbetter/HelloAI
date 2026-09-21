"use client";

import { useMemo, useState } from "react";

type Plugin = { id: string; name: string; category: string; description: string; status: "available" | "connected"; href: string };

const initialPlugins: Plugin[] = [
  { id: "wordpress", name: "WordPress", category: "Publishing", description: "Publish approved website and SEO updates through the WordPress REST API.", status: "available", href: "/website" },
  { id: "shopify", name: "Shopify", category: "Publishing", description: "Connect a Shopify store for commerce pages and metadata workflows.", status: "available", href: "/website" },
  { id: "webflow", name: "Webflow", category: "Publishing", description: "Send website changes to a connected Webflow project.", status: "available", href: "/website" },
  { id: "github-vercel", name: "GitHub / Vercel", category: "Publishing", description: "Prepare repository changes and deployment workflows for review.", status: "available", href: "/website" },
  { id: "search-console", name: "Google Search Console", category: "Analytics", description: "Bring real queries, clicks, impressions, and indexing signals into SEO decisions.", status: "available", href: "/seo" },
  { id: "analytics", name: "Google Analytics", category: "Analytics", description: "Use traffic and conversion data to prioritize pages that can create revenue.", status: "available", href: "/seo" },
  { id: "business-profile", name: "Google Business Profile", category: "Local growth", description: "Plan posts, service descriptions, Q&A content, and review responses.", status: "available", href: "/seo" },
  { id: "custom", name: "Custom CMS", category: "Publishing", description: "Connect any CMS that accepts authenticated HelloAI patch requests.", status: "available", href: "/website" },
  { id: "whatsapp", name: "WhatsApp", category: "Lead generation", description: "Turn website visitors into conversations with a direct WhatsApp action.", status: "available", href: "/website" },
];

export default function PluginsPage() {
  const [plugins, setPlugins] = useState(initialPlugins);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(plugins.map((plugin) => plugin.category)))];
  const visiblePlugins = useMemo(() => plugins.filter((plugin) => (category === "All" || plugin.category === category) && `${plugin.name} ${plugin.description}`.toLowerCase().includes(query.toLowerCase())), [plugins, category, query]);

  return <main className="plugins-shell"><aside className="task-workspace-sidebar"><div className="task-brand"><span>H</span><strong>HelloAI</strong></div><a className="task-search" href="/">← Back to workspace</a><a className="task-new-button" href="/website">＋ New task</a><nav className="task-nav"><a href="/">⌂ <span>Home</span></a><a href="/website">▤ <span>Website Builder</span></a><a href="/seo">⌕ <span>SEO Engine</span></a><a href="/scheduled">◷ <span>Scheduled</span></a><a className="selected" href="/plugins">⌘ <span>Plugins</span></a></nav></aside><section className="plugins-main"><header className="plugins-header"><div><span className="eyebrow">EXTENSIONS / CONNECTIONS</span><h1>Plugins</h1><p>Connect the systems HelloAI needs to build, measure, publish, and grow your business.</p></div><a className="primary-button" href="/website">Connect a provider →</a></header><div className="plugins-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins" /><div>{categories.map((item) => <button key={item} className={category === item ? "active" : ""} type="button" onClick={() => setCategory(item)}>{item}</button>)}</div></div><section className="plugins-grid">{visiblePlugins.map((plugin) => <article className="plugin-card" key={plugin.id}><div className="plugin-card-top"><span className="plugin-mark">✦</span><span className={`plugin-status ${plugin.status}`}>{plugin.status === "connected" ? "Connected" : "Available"}</span></div><span className="eyebrow">{plugin.category}</span><h2>{plugin.name}</h2><p>{plugin.description}</p><a className="secondary-button" href={plugin.href}>{plugin.status === "connected" ? "Manage connection" : "Set up plugin"} →</a></article>)}</section>{visiblePlugins.length === 0 && <div className="plugins-empty">No plugins match your search.</div>}</section></main>;
}
