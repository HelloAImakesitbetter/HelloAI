"use client";

import { useEffect, useState } from "react";

const toolGroups = {
  code: [
  { label: "Websites", icon: "◎", href: "/website", tone: "blue" },
  { label: "Apps", icon: "▯", href: "/website", tone: "violet" },
  ],
  productivity: [
  { label: "Slides", icon: "▤", href: "/website", tone: "amber" },
  { label: "Reports", icon: "▥", href: "/seo", tone: "blue" },
  { label: "Sheets", icon: "▦", href: "/seo", tone: "green" },
  { label: "Workflows", icon: "⌘", href: "/scheduled", tone: "violet" },
  ],
  content: [
  { label: "Images", icon: "◌", href: "/image", tone: "pink" },
  { label: "Audio", icon: "◉", href: "/seo", tone: "cyan" },
  { label: "Carousels", icon: "▧", href: "/website", tone: "orange" },
  ],
};
const searchItems = [
  { label: "Website Builder", detail: "Create pages, services, FAQs, and booking paths", href: "/website" },
  { label: "SEO Engine", detail: "Audit pages, find opportunities, and apply fixes", href: "/seo" },
  { label: "Business Analyzer", detail: "See SEO, conversion, trust, and growth gaps", href: "/seo" },
  { label: "Competitor Research", detail: "Compare gaps and discover pages to build", href: "/seo" },
  { label: "Lead Generation", detail: "Create quote, booking, call, and contact paths", href: "/website" },
  { label: "Scheduled Tasks", detail: "Manage recurring SEO and growth work", href: "/scheduled" },
  { label: "Image Studio", detail: "Create and edit visual assets", href: "/image" },
];

export default function Home() {
  const [businessName, setBusinessName] = useState("Untitled workspace");
  const [draftCount, setDraftCount] = useState(0);
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<"build" | "grow">("build");
  const [activeCategory, setActiveCategory] = useState<"code" | "productivity" | "content">("code");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationHref, setRecommendationHref] = useState("/website");
  const [recommendationLabel, setRecommendationLabel] = useState("Open website builder");
  const [isThinking, setIsThinking] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("helloai-website-draft");
    if (!saved) return;
    try {
      const project = JSON.parse(saved) as { businessName?: string; draft?: { pages?: unknown[] } };
      setBusinessName(project.businessName || "Untitled workspace");
      setDraftCount(project.draft?.pages?.length || 0);
    } catch { /* Ignore stale browser data. */ }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const submitTask = async () => {
    if (!task.trim() || isThinking) return;
    const lowerTask = task.toLowerCase();
    const isGrowthTask = lowerTask.includes("seo") || lowerTask.includes("rank") || lowerTask.includes("competitor") || lowerTask.includes("traffic") || mode === "grow";
    setIsThinking(true);
    setRecommendation("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: task }], businessName, description: task, progress: `homepage ${mode} mode` }) });
      const data = await response.json();
      setRecommendation(response.ok ? data.reply : `I recommend starting with ${isGrowthTask ? "a full SEO and competitor analysis" : "a complete website brief"}.`);
    } catch {
      setRecommendation(`I recommend starting with ${isGrowthTask ? "a full SEO and competitor analysis" : "a complete website brief"}.`);
    } finally {
      setRecommendationHref(isGrowthTask ? "/seo" : "/website");
      setRecommendationLabel(isGrowthTask ? "Open SEO growth workspace" : "Open website builder");
      setIsThinking(false);
    }
  };

  return (
    <main className="task-workspace-shell">
      <aside className="task-workspace-sidebar">
        <div className="task-brand"><span>H</span><strong>HelloAI</strong></div>
        <button className="task-search" type="button" onClick={() => setSearchOpen(true)}>⌕ <span>Search</span><kbd>⌘ K</kbd></button>
        <a className="task-new-button" href="/website">＋ New task</a>
        <nav className="task-nav"><a className="selected" href="/">⌂ <span>Home</span></a><a href="/website">▤ <span>Website Builder</span></a><a href="/seo">⌕ <span>SEO Engine</span></a><a href="/scheduled">◷ <span>Scheduled</span></a><a href="/plugins">⌘ <span>Plugins</span></a><a href="/seo">▣ <span>Notetaker</span><em>Free</em></a><a href="/seo">••• <span>Explore</span></a></nav>
        <div className="task-sidebar-section"><span>Projects</span><button type="button">＋</button><p>No projects yet</p></div>
        <div className="task-sidebar-section history"><span>History</span><p className="history-item"><i />{businessName}</p></div>
        <div className="task-account"><span>A</span><div><strong>Account</strong><small>Personal workspace</small></div><b>•••</b></div>
      </aside>

      <section className="task-workspace-main">
        <header className="task-topbar"><span className="task-mobile-brand">HelloAI</span><span className="task-topbar-spacer" /><button type="button">◌</button><button type="button">?</button><span className="task-credit">Free plan</span></header>
        <div className="task-mode-switch"><button className={mode === "build" ? "active" : ""} type="button" onClick={() => setMode("build")}>Build</button><button className={mode === "grow" ? "active" : ""} type="button" onClick={() => setMode("grow")}>Grow</button></div>
        <section className="task-hero"><span className="eyebrow">{mode === "build" ? "BUILD MODE" : "GROWTH MODE"}</span><h1>What needs to be done?</h1><p className="task-hero-intro">Tell HelloAI what you are trying to achieve. It will recommend the best next step before taking you there.</p><div className="task-composer"><textarea value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} placeholder={mode === "build" ? "Tell me what you want to make or improve..." : "Tell me how you want to grow your business..."} />{(isThinking || recommendation) && <div className="task-inline-response"><span className="eyebrow">{isThinking ? "HELLOAI IS THINKING" : "HELLOAI RECOMMENDS"}</span><p>{isThinking ? "Working out the best next step..." : recommendation}</p>{recommendation && <a className="primary-button" href={recommendationHref}>{recommendationLabel} →</a>}</div>}<div className="task-composer-footer"><button type="button">＋</button><span>{mode === "grow" ? "Growth agent" : "HelloAI agent"}⌄</span><span className="task-composer-spacer" /><button type="button">Auto⌄</button><button className="task-submit" type="button" onClick={() => void submitTask()} disabled={!task.trim() || isThinking}>{isThinking ? "…" : "→"}</button></div></div></section>

        <section className="task-tool-groups">{(["code", "productivity", "content"] as const).map((category) => <div className="task-group" key={category}><button className="task-group-heading" type="button" onClick={() => setActiveCategory(activeCategory === category ? category : category)}><span>{category === "code" ? "Code" : category === "productivity" ? "Productivity" : "Content creation"}</span><b>⌄</b></button>{activeCategory === category ? <div className="task-tool-grid">{toolGroups[category].map((tool) => <a className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></a>)}</div> : <div className="task-group-summary">{toolGroups[category].map((tool) => tool.label).join(" · ")}</div>}</div>)}</section>

        <section className="task-bottom-grid"><article><span className="eyebrow">QUICK START</span><h2>Make the next useful thing.</h2><p>Start with the website builder or ask the growth agent to audit, plan, and prioritize your business.</p><div className="task-bottom-links"><a href="/website">Build a website →</a><a href="/seo">Grow my business →</a></div></article><article className="task-project-card"><span className="eyebrow">CURRENT PROJECT</span><strong>{businessName}</strong><p>{draftCount ? `${draftCount} website pages in your draft` : "No active project yet"}</p><a href="/website">Open project →</a></article></section>
      </section>
      {searchOpen && <div className="task-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="task-search-dialog" role="dialog" aria-modal="true" aria-label="Search HelloAI"><div className="task-search-input-wrap"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search HelloAI" /><kbd>Esc</kbd></div><div className="task-search-results">{searchItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => <a key={item.label} href={item.href} onClick={() => setSearchOpen(false)}><span>→</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></a>)}{searchItems.every((item) => !`${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p className="task-search-empty">No matching HelloAI feature found.</p>}</div></section></div>}
    </main>
  );
}
