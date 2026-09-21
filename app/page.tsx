"use client";

import { useEffect, useState } from "react";

const quickTools = [
  { label: "Websites", icon: "◎", href: "/website", tone: "blue" },
  { label: "Apps", icon: "▯", href: "/website", tone: "violet" },
  { label: "Slides", icon: "▤", href: "/website", tone: "amber" },
  { label: "Reports", icon: "▥", href: "/seo", tone: "blue" },
  { label: "Sheets", icon: "▦", href: "/seo", tone: "green" },
  { label: "Workflows", icon: "⌘", href: "/seo", tone: "violet" },
  { label: "Images", icon: "◌", href: "/image", tone: "pink" },
  { label: "Audio", icon: "◉", href: "/seo", tone: "cyan" },
  { label: "Carousels", icon: "▧", href: "/website", tone: "orange" },
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

  useEffect(() => {
    const saved = window.localStorage.getItem("helloai-website-draft");
    if (!saved) return;
    try {
      const project = JSON.parse(saved) as { businessName?: string; draft?: { pages?: unknown[] } };
      setBusinessName(project.businessName || "Untitled workspace");
      setDraftCount(project.draft?.pages?.length || 0);
    } catch { /* Ignore stale browser data. */ }
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

  const visibleTools = activeCategory === "code" ? quickTools.slice(0, 2) : activeCategory === "productivity" ? quickTools.slice(2, 6) : quickTools.slice(6);

  return (
    <main className="task-workspace-shell">
      <aside className="task-workspace-sidebar">
        <div className="task-brand"><span>H</span><strong>HelloAI</strong></div>
        <button className="task-search" type="button">⌕ <span>Search</span><kbd>⌘ K</kbd></button>
        <a className="task-new-button" href="/website">＋ New task</a>
        <nav className="task-nav"><a className="selected" href="/">⌂ <span>Home</span></a><a href="/website">▤ <span>Website Builder</span></a><a href="/seo">⌕ <span>SEO Engine</span></a><a href="/seo">◷ <span>Scheduled</span></a><a href="/seo">⌘ <span>Plugins</span></a><a href="/seo">▣ <span>Notetaker</span><em>Free</em></a><a href="/seo">••• <span>Explore</span></a></nav>
        <div className="task-sidebar-section"><span>Projects</span><button type="button">＋</button><p>No projects yet</p></div>
        <div className="task-sidebar-section history"><span>History</span><p className="history-item"><i />{businessName}</p></div>
        <div className="task-account"><span>A</span><div><strong>Account</strong><small>Personal workspace</small></div><b>•••</b></div>
      </aside>

      <section className="task-workspace-main">
        <header className="task-topbar"><span className="task-mobile-brand">HelloAI</span><span className="task-topbar-spacer" /><button type="button">◌</button><button type="button">?</button><span className="task-credit">Free plan</span></header>
        <div className="task-mode-switch"><button className={mode === "build" ? "active" : ""} type="button" onClick={() => setMode("build")}>Build</button><button className={mode === "grow" ? "active" : ""} type="button" onClick={() => setMode("grow")}>Grow</button></div>
        <section className="task-hero"><span className="eyebrow">{mode === "build" ? "BUILD MODE" : "GROWTH MODE"}</span><h1>What needs to be done?</h1><p className="task-hero-intro">Tell HelloAI what you are trying to achieve. It will recommend the best next step before taking you there.</p><div className="task-composer"><textarea value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} placeholder={mode === "build" ? "Tell me what you want to make or improve..." : "Tell me how you want to grow your business..."} />{(isThinking || recommendation) && <div className="task-inline-response"><span className="eyebrow">{isThinking ? "HELLOAI IS THINKING" : "HELLOAI RECOMMENDS"}</span><p>{isThinking ? "Working out the best next step..." : recommendation}</p>{recommendation && <a className="primary-button" href={recommendationHref}>{recommendationLabel} →</a>}</div>}<div className="task-composer-footer"><button type="button">＋</button><span>{mode === "grow" ? "Growth agent" : "HelloAI agent"}⌄</span><span className="task-composer-spacer" /><button type="button">Auto⌄</button><button className="task-submit" type="button" onClick={() => void submitTask()} disabled={!task.trim() || isThinking}>{isThinking ? "…" : "→"}</button></div></div></section>

        <section className="task-tool-groups"><div className="task-group"><button className="task-group-heading" type="button" onClick={() => setActiveCategory("code")}><span>Code</span><b>⌄</b></button><div className="task-tool-grid">{visibleTools.map((tool) => <a className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></a>)}</div></div><div className="task-group"><button className="task-group-heading" type="button" onClick={() => setActiveCategory("productivity")}><span>Productivity</span><b>⌄</b></button>{activeCategory === "productivity" && <div className="task-tool-grid">{visibleTools.map((tool) => <a className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></a>)}</div>} {activeCategory !== "productivity" && <div className="task-group-summary">Reports · Sheets · Workflows</div>}</div><div className="task-group"><button className="task-group-heading" type="button" onClick={() => setActiveCategory("content")}><span>Content creation</span><b>⌄</b></button>{activeCategory === "content" && <div className="task-tool-grid">{visibleTools.map((tool) => <a className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></a>)}</div>} {activeCategory !== "content" && <div className="task-group-summary">Images · Audio · Carousels</div>}</div></section>

        <section className="task-bottom-grid"><article><span className="eyebrow">QUICK START</span><h2>Make the next useful thing.</h2><p>Start with the website builder or ask the growth agent to audit, plan, and prioritize your business.</p><div className="task-bottom-links"><a href="/website">Build a website →</a><a href="/seo">Grow my business →</a></div></article><article className="task-project-card"><span className="eyebrow">CURRENT PROJECT</span><strong>{businessName}</strong><p>{draftCount ? `${draftCount} website pages in your draft` : "No active project yet"}</p><a href="/website">Open project →</a></article></section>
      </section>
    </main>
  );
}
