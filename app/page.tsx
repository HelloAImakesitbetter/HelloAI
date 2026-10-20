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
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type SavedConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated_at: string;
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
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [conversationNotice, setConversationNotice] = useState("");
  const [mode, setMode] = useState<"build" | "grow">("build");
  const [activeCategory, setActiveCategory] = useState<"code" | "productivity" | "content">("code");
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
  const userBrief = conversation.filter((message) => message.role === "user").map((message) => message.content).join("\n");
  const canPrepareWebsitePlan = /\b(website|web site|webpage|web page|landing page|online store)\b/i.test(userBrief);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      return () => { active = false; };
    }

    const syncSession = async (accessToken?: string, userId?: string) => {
      if (!active) return;
      setAgentAccessToken(accessToken || "");
      setChatUserId(userId || null);
      setAgentError("");
      if (!accessToken) {
        setSavedConversations([]);
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

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session?.access_token, data.session?.user.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.access_token, session?.user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !chatUserId) return;
    let active = true;
    const loadSavedConversations = async () => {
      const { data, error } = await client
        .from("chat_conversations")
        .select("id, title, messages, updated_at")
        .eq("user_id", chatUserId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (!active) return;
      if (error) {
        setConversationNotice("Saved chats are unavailable. Apply supabase/migrations/004_chat_conversations.sql in your Supabase SQL Editor to enable them.");
        return;
      }
      setSavedConversations((data || []).map((row) => ({
        id: row.id,
        title: row.title,
        messages: row.messages as ChatMessage[],
        updated_at: row.updated_at,
      })));
      setConversationNotice("");
    };
    void loadSavedConversations();
    return () => { active = false; };
  }, [chatUserId]);

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
    const nextMessages: ChatMessage[] = [...conversation, { role: "user", content: task.trim() }];
    setIsThinking(true);
    setAgentError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          businessName,
          description: nextMessages.filter((message) => message.role === "user").map((message) => message.content).join("\n"),
          progress: `home ${mode} mode; clarifying a customer request before preparing a plan`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "HelloAI couldn't reply");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("HelloAI returned an empty reply. Please try again.");
      setConversation([...nextMessages, { role: "assistant", content: data.reply.trim() }]);
      setTask("");
    } catch (requestError) {
      setAgentError(requestError instanceof Error ? requestError.message : "HelloAI couldn't reply");
    } finally {
      setIsThinking(false);
    }
  };

  const startNewConversation = () => {
    if (conversation.length > 0 && !window.confirm("Start a new chat? This clears the current chat but does not delete any saved copy.")) return;
    setConversation([]);
    setActiveConversationId(null);
    setTask("");
    setAgentError("");
    setConversationNotice("");
  };

  const openSavedConversation = (saved: SavedConversation) => {
    setConversation(saved.messages);
    setActiveConversationId(saved.id);
    setTask("");
    setAgentError("");
    setConversationNotice(`Opened saved chat “${saved.title}”. New messages are not saved until you choose Save.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveConversation = async () => {
    if (!supabase || !chatUserId || isSavingConversation || conversation.length === 0) return;
    if (conversation.length > 100) {
      setAgentError("This chat is too long to save. Start a new chat or save a shorter conversation.");
      return;
    }
    setIsSavingConversation(true);
    setAgentError("");
    try {
      const firstMessage = conversation.find((message) => message.role === "user")?.content || "HelloAI conversation";
      const title = firstMessage.trim().replace(/\s+/g, " ").slice(0, 117) + (firstMessage.trim().length > 117 ? "..." : "");
      const savedAt = new Date().toISOString();
      const result = activeConversationId
        ? await supabase.from("chat_conversations").update({ title, messages: conversation, updated_at: savedAt }).eq("id", activeConversationId).eq("user_id", chatUserId).select("id, title, messages, updated_at").single()
        : await supabase.from("chat_conversations").insert({ user_id: chatUserId, title, messages: conversation }).select("id, title, messages, updated_at").single();
      if (result.error || !result.data) {
        throw new Error(result.error?.message || "The conversation was not returned after saving.");
      }
      const saved: SavedConversation = {
        id: result.data.id,
        title: result.data.title,
        messages: result.data.messages as ChatMessage[],
        updated_at: result.data.updated_at,
      };
      setActiveConversationId(saved.id);
      setSavedConversations((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 20));
      setConversationNotice("Chat saved to your account. Future messages still require you to save again.");
    } catch (saveError) {
      setAgentError(saveError instanceof Error ? saveError.message : "Could not save this conversation.");
    } finally {
      setIsSavingConversation(false);
    }
  };

  const deleteSavedConversation = async (id: string) => {
    if (!supabase || !chatUserId) return;
    const saved = savedConversations.find((item) => item.id === id);
    if (!saved || !window.confirm(`Delete the saved chat “${saved.title}”? This cannot be undone.`)) return;
    setAgentError("");
    const { error } = await supabase.from("chat_conversations").delete().eq("id", id).eq("user_id", chatUserId);
    if (error) {
      setAgentError(`Could not delete the saved chat: ${error.message}`);
      return;
    }
    setSavedConversations((current) => current.filter((item) => item.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setConversation([]);
      setConversationNotice("Saved chat deleted.");
    }
  };

  const createPlan = async () => {
    if (!canPrepareWebsitePlan || isPlanning) return;
    if (!supabase) {
      setAgentError("Supabase is not configured. Add its URL and public key to .env.local, then restart the app.");
      return;
    }
    if (userBrief.length > 4000) {
      setAgentError("This website brief is longer than the 4,000-character planning limit. Shorten it and try again.");
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
        body: JSON.stringify({ goal: userBrief }),
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
        <section className="task-hero">
          <span className="eyebrow">YOUR HELLOAI ASSISTANT</span>
          <h1>How can I help?</h1>
          <p className="task-hero-intro">Ask about anything, think something through, or work on a project together. Your chats stay private to this session unless you choose to save one.</p>
          <div className="task-chat-actions">
            {conversation.length > 0 && <button className="task-reset-conversation" type="button" onClick={startNewConversation}>New chat</button>}
            {conversation.length > 0 && (chatUserId
              ? <button className="task-save-conversation" type="button" onClick={() => void saveConversation()} disabled={isSavingConversation}>{isSavingConversation ? "Saving..." : activeConversationId ? "Save changes" : "Save conversation"}</button>
              : <Link className="task-auth-link" href="/login">Sign in to save this chat</Link>)}
          </div>
          <div className="task-composer">
            {conversation.length > 0
              ? <div className="task-conversation" aria-live="polite">{conversation.map((message, index) => <article className={`task-chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "HelloAI" : "You"}</span><p>{message.content}</p></article>)}</div>
              : <div className="task-chat-welcome"><span className="task-chat-avatar">H</span><div><strong>Hello, I’m HelloAI.</strong><p>Ask me a question, share an idea, or tell me what you’re working on.</p></div></div>}
            {isThinking && <p className="task-chat-thinking" role="status">HelloAI is thinking…</p>}
            <textarea aria-label="Message HelloAI" value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} placeholder="Message HelloAI about anything..." />
            {agentMessage && <p className="task-agent-message" role="status">{agentMessage}</p>}
            {agentError && <div className="task-agent-error" role="alert">{agentError}</div>}
            {conversationNotice && <p className="task-chat-notice" role="status">{conversationNotice}</p>}
            <div className="task-composer-footer">
              <span>Chats are not saved unless you choose to save them.</span>
              <span className="task-composer-spacer" />
              {canPrepareWebsitePlan && <button className="task-plan-button" type="button" onClick={() => void createPlan()} disabled={isPlanning || !agentAccessToken}>{isPlanning ? "Preparing..." : "Prepare website plan"}</button>}
              <button className="task-submit" type="button" aria-label="Send message to HelloAI" onClick={() => void submitTask()} disabled={!task.trim() || isThinking}>{isThinking ? "…" : "→"}</button>
            </div>
          </div>
          <details className="task-saved-conversations">
            <summary>Saved chats ({savedConversations.length})</summary>
            {conversationNotice.startsWith("Saved chats are unavailable") && <p className="task-chat-notice" role="status">{conversationNotice}</p>}
            {savedConversations.length > 0
              ? <div className="task-saved-chat-list">{savedConversations.map((saved) => <div className="task-saved-chat" key={saved.id}><button type="button" onClick={() => openSavedConversation(saved)}><strong>{saved.title}</strong><small>Saved {new Date(saved.updated_at).toLocaleDateString()}</small></button><button className="task-delete-chat" type="button" aria-label={`Delete saved chat ${saved.title}`} onClick={() => void deleteSavedConversation(saved.id)}>Delete</button></div>)}</div>
              : <p className="task-chat-notice">Saved conversations will appear here. Nothing is stored until you select “Save conversation”.</p>}
          </details>
        </section>

        <section className="task-agent-history" aria-labelledby="agent-history-heading">
          <div className="task-agent-history-heading"><div><span className="eyebrow">AGENT RUNS</span><h2 id="agent-history-heading">Saved plans</h2></div><span>{agentRuns.length} / 20</span></div>
          {agentRuns.length === 0 ? <p className="task-agent-empty">{agentError || agentMessage || "Sign in to create and keep task plans."} {!agentAccessToken && supabase && <Link href="/login">Sign in →</Link>}</p> : <div className="task-agent-history-layout">
            <div className="task-agent-run-list">{agentRuns.map((run) => <button className={run.id === selectedRun?.id ? "task-agent-run selected" : "task-agent-run"} key={run.id} type="button" onClick={() => setSelectedRunId(run.id)}><span>{run.goal}</span><small><b>{run.status}</b> · {new Date(run.createdAt).toLocaleDateString()}</small></button>)}</div>
            {selectedRun && <article className="task-agent-run-detail"><div className="task-agent-run-title"><h3>{selectedRun.goal}</h3><span className="task-agent-status">{selectedRun.status}</span></div><p className="task-agent-notice">{selectedRun.status === "planned" ? "Nothing has been generated yet. Approving starts website draft generation; it will not publish the site." : selectedRun.status === "queued" || selectedRun.status === "running" ? "The background worker is processing this task." : selectedRun.status === "completed" ? "Verified website draft saved in this run." : selectedRun.status === "failed" ? "The task failed; see the error below." : selectedRun.status === "cancelled" ? "This run was cancelled." : `Run status: ${selectedRun.status}.`}</p>{selectedRun.status === "planned" && <button className="primary-button" type="button" disabled={actingRunId === selectedRun.id} onClick={() => void updateRun(selectedRun, "start")}>{actingRunId === selectedRun.id ? "Starting..." : "Approve & generate draft"}</button>}{(selectedRun.status === "queued" || selectedRun.status === "running") && <button className="secondary-button" type="button" disabled={actingRunId === selectedRun.id || selectedRun.cancelRequested} onClick={() => void updateRun(selectedRun, "cancel")}>{selectedRun.cancelRequested ? "Cancellation requested" : actingRunId === selectedRun.id ? "Cancelling..." : "Cancel run"}</button>}<strong>Success criteria</strong><ul>{selectedRun.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><strong>Planned steps</strong><ol>{selectedRun.tasks.map((agentTask) => <li key={agentTask.key}><span>{agentTask.title}</span><small>{agentTask.toolName} · {agentTask.status}{agentTask.requiresApproval ? " · approval required" : ""}</small>{agentTask.errorMessage && <small className="task-agent-run-error">{agentTask.errorMessage}</small>}{agentTask.evidence && <small>Verified {agentTask.evidence.pageCount} pages; home page {agentTask.evidence.hasHomePage ? "present" : "missing"}.</small>}{agentTask.result?.pages && <ul className="task-agent-page-results">{agentTask.result.pages.map((page) => <li key={page.slug}>{page.label}: {page.title}</li>)}</ul>}</li>)}</ol></article>}
          </div>}
        </section>

        <section className="task-tool-groups">{(["code", "productivity", "content"] as const).map((category) => <div className="task-group" key={category}><button className="task-group-heading" type="button" onClick={() => setActiveCategory(activeCategory === category ? category : category)}><span>{category === "code" ? "Code" : category === "productivity" ? "Productivity" : "Content creation"}</span><b>⌄</b></button>{activeCategory === category ? <div className="task-tool-grid">{toolGroups[category].map((tool) => <Link className={`task-tool-card ${tool.tone}`} key={tool.label} href={tool.href}><span>{tool.icon}</span><strong>{tool.label}</strong></Link>)}</div> : <div className="task-group-summary">{toolGroups[category].map((tool) => tool.label).join(" · ")}</div>}</div>)}</section>

        <section className="task-bottom-grid"><article><span className="eyebrow">QUICK START</span><h2>Make the next useful thing.</h2><p>Start with the website builder or ask the growth agent to audit, plan, and prioritize your business.</p><div className="task-bottom-links"><Link href="/website">Build a website →</Link><Link href="/seo">Grow my business →</Link></div></article><article className="task-project-card"><span className="eyebrow">CURRENT PROJECT</span><strong>{businessName}</strong><p>{draftCount ? `${draftCount} website pages in your draft` : "No active project yet"}</p><Link href="/website">Open project →</Link></article></section>
      </section>
      {searchOpen && <div className="task-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="task-search-dialog" role="dialog" aria-modal="true" aria-label="Search HelloAI"><div className="task-search-input-wrap"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search HelloAI" /><kbd>Esc</kbd></div><div className="task-search-results">{searchItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => <Link key={item.label} href={item.href} onClick={() => setSearchOpen(false)}><span>→</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></Link>)}{searchItems.every((item) => !`${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p className="task-search-empty">No matching HelloAI feature found.</p>}</div></section></div>}
    </main>
  );
}
