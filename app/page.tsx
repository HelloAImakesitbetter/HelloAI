"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AgentTask = {
  key: string;
  title: string;
  description: string;
  toolName: string;
  requiresApproval: boolean;
  status: string;
  dependsOn: string[];
  result?: { pages?: { slug: string; label: string; title: string }[] } | null;
  evidence?: { pageCount?: number; hasHomePage?: boolean; generatedAt?: string } | null;
  errorMessage?: string | null;
};
type AgentRun = {
  id: string;
  goal: string;
  status: string;
  cancelRequested: boolean;
  successCriteria: string[];
  createdAt: string;
  tasks: AgentTask[];
};

async function fetchAgentRuns(accessToken: string): Promise<AgentRun[]> {
  const response = await fetch("/api/agent/runs", { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load saved plans");
  return data.runs as AgentRun[];
}

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
  const [businessName] = useState(() => {
    if (typeof window === "undefined") return "Untitled workspace";
    try {
      const saved = window.localStorage.getItem("helloai-website-draft");
      if (!saved) return "Untitled workspace";
      const project = JSON.parse(saved) as { businessName?: string };
      return project.businessName || "Untitled workspace";
    } catch {
      return "Untitled workspace";
    }
  });
  const [draftCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = window.localStorage.getItem("helloai-website-draft");
      if (!saved) return 0;
      const project = JSON.parse(saved) as { draft?: { pages?: unknown[] } };
      return project.draft?.pages?.length || 0;
    } catch {
      return 0;
    }
  });
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<"build" | "grow">("build");
  const [activeCategory, setActiveCategory] = useState<"code" | "productivity" | "content">("code");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationHref, setRecommendationHref] = useState("/website");
  const [recommendationLabel, setRecommendationLabel] = useState("Open website builder");
  const [isThinking, setIsThinking] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentAccessToken, setAgentAccessToken] = useState("");
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [actingRunId, setActingRunId] = useState("");
  const [agentMessage, setAgentMessage] = useState(() => supabase ? "" : "Supabase is not configured. Add the project URL and public key to .env.local, then restart the app.");
  const [agentError, setAgentError] = useState("");

  const selectedRun = agentRuns.find((run) => run.id === selectedRunId) || agentRuns[0];
  const hasActiveAgentRun = agentRuns.some((run) => run.status === "queued" || run.status === "running");

  useEffect(() => {
    let active = true;
    if (!supabase) {
      return () => { active = false; };
    }

    const syncSession = async (accessToken?: string) => {
      if (!active) return;
      setAgentAccessToken(accessToken || "");
      setAgentError("");
      if (!accessToken) {
        setAgentRuns([]);
        setSelectedRunId("");
        setAgentMessage("Sign in to save and view task plans.");
        return;
      }

      setAgentMessage("Loading saved plans...");
      try {
        const runs = await fetchAgentRuns(accessToken);
        if (!active) return;
        setAgentRuns(runs);
        setSelectedRunId((current) => runs.some((run) => run.id === current) ? current : runs[0]?.id || "");
        setAgentMessage(runs.length ? "Your recent plans are saved to this account." : "No saved plans yet.");
      } catch (requestError) {
        if (!active) return;
        setAgentError(requestError instanceof Error ? requestError.message : "Could not load saved plans");
        setAgentMessage("");
      }
    };

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session?.access_token));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.access_token);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!agentAccessToken || !hasActiveAgentRun) return;
    let active = true;
    const refreshRuns = async () => {
      try {
        const runs = await fetchAgentRuns(agentAccessToken);
        if (active) setAgentRuns(runs);
      } catch (requestError) {
        if (active) setAgentError(requestError instanceof Error ? requestError.message : "Could not refresh run status");
      }
    };
    const interval = window.setInterval(() => void refreshRuns(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [agentAccessToken, hasActiveAgentRun]);

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

  const createPlan = async () => {
    if (!task.trim() || isPlanning) return;
    if (!supabase) {
      setAgentError("Supabase is not configured. Add its URL and public key to .env.local, then restart the app.");
      return;
    }

    setIsPlanning(true);
    setAgentError("");
    setAgentMessage("Building a plan...");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("Sign in before creating a saved task plan.");

      const response = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ goal: task }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create task plan");

      const createdRun = data.run as AgentRun;
      setAgentRuns((current) => [createdRun, ...current.filter((run) => run.id !== createdRun.id)].slice(0, 20));
      setSelectedRunId(createdRun.id);
      setAgentMessage("Plan saved. No tasks have been executed.");
      try {
        const runs = await fetchAgentRuns(accessToken);
        setAgentRuns(runs);
      } catch {
        setAgentMessage("Plan saved. Run history could not refresh, but the plan is shown here.");
      }
    } catch (requestError) {
      setAgentError(requestError instanceof Error ? requestError.message : "Could not create task plan");
      setAgentMessage("");
    } finally {
      setIsPlanning(false);
    }
  };

  const updateRun = async (run: AgentRun, action: "start" | "cancel") => {
    if (!agentAccessToken || actingRunId) return;
    setActingRunId(run.id);
    setAgentError("");
    setAgentMessage(action === "start" ? "Queueing this task..." : "Requesting cancellation...");
    try {
      const response = await fetch(action === "start" ? `/api/agent/runs/${run.id}/start` : `/api/agent/runs/${run.id}`, {
        method: action === "start" ? "POST" : "PATCH",
        headers: { Authorization: `Bearer ${agentAccessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not ${action} this task`);
      const runs = await fetchAgentRuns(agentAccessToken);
      setAgentRuns(runs);
      setAgentMessage(action === "start" ? "Task queued. The worker will update its status and result here." : "Cancellation requested. An in-progress generation may finish before stopping.");
    } catch (requestError) {
      setAgentError(requestError instanceof Error ? requestError.message : `Could not ${action} this task`);
      setAgentMessage("");
    } finally {
      setActingRunId("");
    }
  };

  return (
    <main className="task-workspace-shell">
      <aside className="task-workspace-sidebar">
        <div className="task-brand"><span>H</span><strong>HelloAI</strong></div>
        <button className="task-search" type="button" onClick={() => setSearchOpen(true)}>⌕ <span>Search</span><kbd>⌘ K</kbd></button>
        <Link className="task-new-button" href="/website">＋ New task</Link>
        <nav className="task-nav"><Link className="selected" href="/">⌂ <span>Home</span></Link><Link href="/website">▤ <span>Website Builder</span></Link><Link href="/seo">⌕ <span>SEO Engine</span></Link><Link href="/scheduled">◷ <span>Scheduled</span></Link><Link href="/plugins">⌘ <span>Plugins</span></Link><Link href="/seo">▣ <span>Notetaker</span><em>Free</em></Link><Link href="/seo">••• <span>Explore</span></Link></nav>
        <div className="task-sidebar-section"><span>Projects</span><button type="button">＋</button><p>No projects yet</p></div>
        <div className="task-sidebar-section history"><span>History</span><p className="history-item"><i />{businessName}</p></div>
        <div className="task-account"><span>A</span><div><strong>Account</strong><small>Personal workspace</small></div><b>•••</b></div>
      </aside>

      <section className="task-workspace-main">
        <header className="task-topbar"><span className="task-mobile-brand">HelloAI</span><span className="task-topbar-spacer" /><button type="button">◌</button><button type="button">?</button><span className="task-credit">Free plan</span></header>
        <div className="task-mode-switch"><button className={mode === "build" ? "active" : ""} type="button" onClick={() => setMode("build")}>Build</button><button className={mode === "grow" ? "active" : ""} type="button" onClick={() => setMode("grow")}>Grow</button></div>
        <section className="task-hero"><span className="eyebrow">{mode === "build" ? "BUILD MODE" : "GROWTH MODE"}</span><h1>What needs to be done?</h1><p className="task-hero-intro">Tell HelloAI what you are trying to achieve. It will recommend the best next step before taking you there.</p><div className="task-composer"><textarea value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} placeholder={mode === "build" ? "Tell me what you want to make or improve..." : "Tell me how you want to grow your business..."} />{(isThinking || recommendation) && <div className="task-inline-response"><span className="eyebrow">{isThinking ? "HELLOAI IS THINKING" : "HELLOAI RECOMMENDS"}</span><p>{isThinking ? "Working out the best next step..." : recommendation}</p>{recommendation && <Link className="primary-button" href={recommendationHref}>{recommendationLabel} →</Link>}</div>}{agentMessage && <p className="task-agent-message" role="status">{agentMessage}</p>}{agentError && <div className="task-agent-error" role="alert">{agentError}</div>}<div className="task-composer-footer"><button type="button">＋</button><span>{mode === "grow" ? "Growth agent" : "HelloAI agent"}⌄</span><span className="task-composer-spacer" /><button className="task-plan-button" type="button" onClick={() => void createPlan()} disabled={!task.trim() || isPlanning || !agentAccessToken}>{isPlanning ? "Planning..." : "Plan task"}</button><button className="task-submit" type="button" onClick={() => void submitTask()} disabled={!task.trim() || isThinking}>{isThinking ? "…" : "→"}</button></div></div></section>

        <section className="task-agent-history" aria-labelledby="agent-history-heading">
          <div className="task-agent-history-heading"><div><span className="eyebrow">AGENT RUNS</span><h2 id="agent-history-heading">Saved plans</h2></div><span>{agentRuns.length} / 20</span></div>
          {agentRuns.length === 0 ? <p className="task-agent-empty">{agentError || agentMessage || "Sign in to create and keep task plans."} {!agentAccessToken && supabase && <Link href="/login">Sign in →</Link>}</p> : <div className="task-agent-history-layout">
            <div className="task-agent-run-list">{agentRuns.map((run) => <button className={run.id === selectedRun?.id ? "task-agent-run selected" : "task-agent-run"} key={run.id} type="button" onClick={() => setSelectedRunId(run.id)}><span>{run.goal}</span><small><b>{run.status}</b> · {new Date(run.createdAt).toLocaleDateString()}</small></button>)}</div>
            {selectedRun && <article className="task-agent-run-detail"><div className="task-agent-run-title"><h3>{selectedRun.goal}</h3><span className="task-agent-status">{selectedRun.status}</span></div><p className="task-agent-notice">{selectedRun.status === "planned" ? "This plan has not started. Starting runs one website-generation task." : selectedRun.status === "queued" || selectedRun.status === "running" ? "The background worker is processing this task." : selectedRun.status === "completed" ? "Verified website draft saved in this run." : selectedRun.status === "failed" ? "The task failed; see the error below." : selectedRun.status === "cancelled" ? "This run was cancelled." : `Run status: ${selectedRun.status}.`}</p>{selectedRun.status === "planned" && <button className="primary-button" type="button" disabled={actingRunId === selectedRun.id} onClick={() => void updateRun(selectedRun, "start")}>{actingRunId === selectedRun.id ? "Starting..." : "Start task"}</button>}{(selectedRun.status === "queued" || selectedRun.status === "running") && <button className="secondary-button" type="button" disabled={actingRunId === selectedRun.id || selectedRun.cancelRequested} onClick={() => void updateRun(selectedRun, "cancel")}>{selectedRun.cancelRequested ? "Cancellation requested" : actingRunId === selectedRun.id ? "Cancelling..." : "Cancel run"}</button>}<strong>Success criteria</strong><ul>{selectedRun.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><strong>Planned steps</strong><ol>{selectedRun.tasks.map((agentTask) => <li key={agentTask.key}><span>{agentTask.title}</span><small>{agentTask.toolName} · {agentTask.status}{agentTask.requiresApproval ? " · approval required" : ""}</small>{agentTask.errorMessage && <small className="task-agent-run-error">{agentTask.errorMessage}</small>}{agentTask.evidence && <small>Verified {agentTask.evidence.pageCount} pages; home page {agentTask.evidence.hasHomePage ? "present" : "missing"}.</small>}{agentTask.result?.pages && <ul className="task-agent-page-results">{agentTask.result.pages.map((page) => <li key={page.slug}>{page.label}: {page.title}</li>)}</ul>}</li>)}</ol></article>}
          </div>}
        </section>

        <section className="task-tool-groups">{(["code", "productivity", "content"] as const).map((category) => <div className="task-group" key={category}><button className="task-group-heading" type="button" onClick={() => setActiveCategory(activeCategory === category ? category : category)}><span>{category === "code" ? "Code" : category === "productivity" ? "Productivity" : "Content creation"}</span><b>⌄</b></button>{activeCategory === category ? <div className="task-tool-grid">{toolGroups[category].map((tool) => <Link className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></Link>)}</div> : <div className="task-group-summary">{toolGroups[category].map((tool) => tool.label).join(" · ")}</div>}</div>)}</section>

        <section className="task-bottom-grid"><article><span className="eyebrow">QUICK START</span><h2>Make the next useful thing.</h2><p>Start with the website builder or ask the growth agent to audit, plan, and prioritize your business.</p><div className="task-bottom-links"><Link href="/website">Build a website →</Link><Link href="/seo">Grow my business →</Link></div></article><article className="task-project-card"><span className="eyebrow">CURRENT PROJECT</span><strong>{businessName}</strong><p>{draftCount ? `${draftCount} website pages in your draft` : "No active project yet"}</p><Link href="/website">Open project →</Link></article></section>
      </section>
      {searchOpen && <div className="task-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="task-search-dialog" role="dialog" aria-modal="true" aria-label="Search HelloAI"><div className="task-search-input-wrap"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search HelloAI" /><kbd>Esc</kbd></div><div className="task-search-results">{searchItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => <Link key={item.label} href={item.href} onClick={() => setSearchOpen(false)}><span>→</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></Link>)}{searchItems.every((item) => !`${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p className="task-search-empty">No matching HelloAI feature found.</p>}</div></section></div>}
    </main>
  );
}
