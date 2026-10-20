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

const helloAiRoutes: Record<string, string> = {
  "/": "Home",
  "/website": "Website Builder",
  "/seo": "SEO Engine",
  "/scheduled": "Scheduled Tasks",
  "/plugins": "Plugins",
  "/image": "Image Studio",
  "/login": "Sign in",
};

function renderChatMessage(content: string) {
  return content.split(/(\[[^\]]+\]\(\/[^)\s]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);
    if (!match || !helloAiRoutes[match[2]]) return part;
    return <Link key={`${match[2]}-${index}`} href={match[2]}>{match[1]}</Link>;
  });
}

async function fetchAgentRuns(accessToken: string): Promise<AgentRun[]> {
  const response = await fetch("/api/agent/runs", { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load saved plans");
  return data.runs as AgentRun[];
}

const searchItems = [
  { label: "Website Builder", detail: "Create pages, services, FAQs, and booking paths", href: "/website" },
  { label: "SEO Engine", detail: "Audit pages, find opportunities, and apply fixes", href: "/seo" },
  { label: "Business Analyzer", detail: "See SEO, conversion, trust, and growth gaps", href: "/seo" },
  { label: "Competitor Research", detail: "Compare gaps and discover pages to build", href: "/seo" },
  { label: "Lead Generation", detail: "Create quote, booking, call, and contact paths", href: "/website" },
  { label: "Scheduled Tasks", detail: "Manage recurring SEO and growth work", href: "/scheduled" },
  { label: "Image Studio", detail: "Create and edit visual assets", href: "/image" },
];
const quickActions = [
  { label: "Websites", icon: "◎", href: "/website" },
  { label: "SEO Engine", icon: "⌕", href: "/seo" },
  { label: "Chat with HelloAI", icon: "◌", href: "#chat" },
  { label: "Image Studio", icon: "▧", href: "/image" },
  { label: "Plugins", icon: "⌘", href: "/plugins" },
  { label: "Scheduled tasks", icon: "◷", href: "/scheduled" },
  { label: "Saved chats", icon: "▤", href: "#saved-chats" },
  { label: "Saved plans", icon: "✓", href: "#agent-runs" },
  { label: "Explore tools", icon: "⌕", href: "#search" },
];
const growQuickActions = [
  { label: "Booking sites", icon: "▣", prompt: "Help me improve my booking website and make it easier for customers to book." },
  { label: "Quotes", icon: "＄", prompt: "Help me create a clear quote and lead follow-up process for my business." },
  { label: "Retention", icon: "↻", prompt: "Suggest practical ways to improve customer retention for my business." },
  { label: "Invoices", icon: "▤", prompt: "Help me design a simple invoicing and payment follow-up workflow." },
  { label: "Social posts", icon: "▧", prompt: "Help me plan social media posts that fit my business and audience." },
  { label: "Site updates", icon: "◎", prompt: "Help me decide what to improve or update on my business website." },
];
const buildMenuItems = [
  { label: "Website Builder", description: "Create and manage your website", icon: "◎", href: "/website" },
  { label: "SEO Engine", description: "Analyze and improve business visibility", icon: "⌕", href: "/seo" },
  { label: "Chat with HelloAI", description: "Talk through any question or idea", icon: "◌", href: "#chat" },
  { label: "Image Studio", description: "Create and edit visual assets", icon: "▧", href: "/image" },
  { label: "Plugins", description: "Connect available integrations", icon: "⌘", href: "/plugins" },
  { label: "Scheduled Tasks", description: "Manage scheduled business tasks", icon: "◷", href: "/scheduled" },
  { label: "Saved Chats", description: "Open or delete saved conversations", icon: "▤", href: "#saved-chats" },
  { label: "Saved Plans", description: "Review and manage agent plans", icon: "✓", href: "#agent-runs" },
];
const growCategories = [
  {
    label: "Running Ads",
    items: [
      { label: "ChatGPT Ads", description: "Campaign ideas and ad copy", icon: "◉", prompt: "Help me plan an advertising campaign for ChatGPT Ads. Suggest an audience, message, and draft ad copy; do not publish anything." },
      { label: "Meta Ads", description: "Ideas for Facebook and Instagram", icon: "f", prompt: "Help me plan a Meta ads campaign for my business, including audience ideas and draft ad copy. Do not publish anything." },
      { label: "Google Ads", description: "Search campaign planning", icon: "G", prompt: "Help me plan a Google Search Ads campaign, including keyword themes and draft ad copy. Do not publish anything." },
      { label: "LinkedIn Ads", description: "Reach a professional audience", icon: "in", prompt: "Help me plan a LinkedIn ads campaign for my business, including audience ideas and draft ad copy. Do not publish anything." },
      { label: "TikTok Ads", description: "Short-form campaign concepts", icon: "♪", prompt: "Help me plan a TikTok ads campaign, including a short video concept and draft script. Do not publish anything." },
    ],
  },
  {
    label: "Social Media",
    items: [
      { label: "Social posts", description: "Plan posts for your channels", icon: "▧", prompt: growQuickActions[4].prompt },
      { label: "Content calendar", description: "Build a practical posting plan", icon: "▦", prompt: "Help me create a realistic social media content calendar for my business." },
      { label: "Social post ideas", description: "Find ideas worth sharing", icon: "✳", prompt: "Suggest engaging social media post ideas for my business and target audience." },
    ],
  },
  {
    label: "Cold Outreach",
    items: [
      { label: "Outreach emails", description: "Write thoughtful first-contact emails", icon: "✉", prompt: "Help me write respectful, personalized cold outreach emails for my business." },
      { label: "Follow-up sequence", description: "Plan helpful follow-ups", icon: "↗", prompt: "Help me create a concise, respectful follow-up sequence for prospective customers." },
    ],
  },
  {
    label: "Social Listening",
    items: [
      { label: "Review responses", description: "Respond to customer feedback", icon: "☆", prompt: "Help me draft thoughtful responses to customer reviews. I will provide the reviews." },
      { label: "Feedback themes", description: "Understand what customers say", icon: "☷", prompt: "Help me identify themes and opportunities from customer feedback I provide." },
    ],
  },
  {
    label: "Organic Growth",
    items: [
      { label: "SEO Engine", description: "Find ways to improve visibility", icon: "⌕", prompt: "Help me improve my business's organic search visibility and prioritize practical SEO steps." },
      { label: "Booking sites", description: "Improve website conversion", icon: "▣", prompt: growQuickActions[0].prompt },
      { label: "Site updates", description: "Plan useful website improvements", icon: "◎", prompt: growQuickActions[5].prompt },
      { label: "Retention", description: "Encourage repeat customers", icon: "↻", prompt: growQuickActions[2].prompt },
    ],
  },
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
  const [task, setTask] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [conversationNotice, setConversationNotice] = useState("");
  const [mode, setMode] = useState<"build" | "grow">("build");
  const [activeGrowCategory, setActiveGrowCategory] = useState(growCategories[0].label);
  const [isThinking, setIsThinking] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentAccessToken, setAgentAccessToken] = useState("");
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [actingRunId, setActingRunId] = useState("");
  const [deletingRunId, setDeletingRunId] = useState("");
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

  const deleteAllSavedConversations = async () => {
    if (!supabase || !chatUserId || savedConversations.length === 0) return;
    if (!window.confirm(`Delete all ${savedConversations.length} saved chats? This cannot be undone.`)) return;
    setAgentError("");
    const { error } = await supabase.from("chat_conversations").delete().eq("user_id", chatUserId);
    if (error) {
      setAgentError(`Could not delete saved chats: ${error.message}`);
      return;
    }
    setSavedConversations([]);
    if (savedConversations.some((saved) => saved.id === activeConversationId)) {
      setActiveConversationId(null);
      setConversation([]);
    }
    setConversationNotice("All saved chats were deleted.");
  };

  const deleteAgentRun = async (run: AgentRun) => {
    if (!agentAccessToken || deletingRunId || run.status === "queued" || run.status === "running") return;
    if (!window.confirm(`Delete the saved plan “${run.goal}” and its results? This cannot be undone.`)) return;
    setDeletingRunId(run.id);
    setAgentError("");
    try {
      const response = await fetch(`/api/agent/runs/${run.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${agentAccessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete saved plan");
      const remainingRuns = agentRuns.filter((item) => item.id !== run.id);
      setAgentRuns(remainingRuns);
      if (selectedRunId === run.id) setSelectedRunId(remainingRuns[0]?.id || "");
      setAgentMessage("Saved plan and its results deleted.");
    } catch (deleteError) {
      setAgentError(deleteError instanceof Error ? deleteError.message : "Could not delete saved plan");
    } finally {
      setDeletingRunId("");
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

  const selectGrowPrompt = (prompt: string, menu?: HTMLDetailsElement | null) => {
    menu?.removeAttribute("open");
    setTask(prompt);
    window.requestAnimationFrame(() => {
      const composer = document.getElementById("chat");
      composer?.scrollIntoView({ behavior: "smooth", block: "center" });
      composer?.querySelector("textarea")?.focus();
    });
  };

  return (
    <main className="task-workspace-shell hello-home-shell">
      <header className="hello-home-header">
        <Link className="hello-home-brand" href="/"><span>H</span><strong>HelloAI</strong></Link>
        <nav className="hello-home-nav" aria-label="Main navigation">
          <details className="hello-home-build-menu">
            <summary>Build <span aria-hidden="true">⌄</span></summary>
            <div className="hello-home-build-popover">
              <div className="hello-home-build-category"><strong>Capabilities</strong><span>Everything you can do with HelloAI</span></div>
              <div className="hello-home-build-items">
                {buildMenuItems.map((item) => <Link key={item.label} href={item.href} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); }}><span className="hello-home-build-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></Link>)}
                <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setSearchOpen(true); }}><span className="hello-home-build-icon">⌕</span><span><strong>Explore tools</strong><small>Search all HelloAI capabilities</small></span></button>
              </div>
            </div>
          </details>
          <details className="hello-home-build-menu hello-home-grow-menu">
            <summary>Grow <span aria-hidden="true">⌄</span></summary>
            <div className="hello-home-build-popover hello-home-grow-popover">
              <div className="hello-home-grow-categories" aria-label="Growth categories">
                {growCategories.map((category) => <button className={activeGrowCategory === category.label ? "active" : ""} key={category.label} type="button" aria-pressed={activeGrowCategory === category.label} onClick={() => setActiveGrowCategory(category.label)}>{category.label}<span>›</span></button>)}
              </div>
              <div className="hello-home-build-items">
                {growCategories.find((category) => category.label === activeGrowCategory)?.items.map((item) => <button key={item.label} type="button" onClick={(event) => selectGrowPrompt(item.prompt, event.currentTarget.closest("details"))}><span className="hello-home-build-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}
                <p className="hello-home-grow-note">Ideas and drafts only. HelloAI does not connect to or launch ad accounts.</p>
              </div>
            </div>
          </details>
          <button type="button" onClick={() => setSearchOpen(true)}>Explore</button>
        </nav>
        <div className="hello-home-header-action">
          {chatUserId ? <span className="task-credit">Free plan</span> : <Link href="/login">Get started</Link>}
        </div>
      </header>
      <section className="task-workspace-main">
        <section className="task-hero">
          <span className="eyebrow">YOUR AI WORKSPACE</span>
          <h1>Build it. Run it.<br />Grow with HelloAI.</h1>
          <p className="task-hero-intro">One AI assistant to explore ideas, make useful things, and keep your business moving.</p>
          <div className="task-mode-switch hello-home-mode-switch"><button className={mode === "build" ? "active" : ""} type="button" aria-pressed={mode === "build"} onClick={() => setMode("build")}>Build</button><button className={mode === "grow" ? "active" : ""} type="button" aria-pressed={mode === "grow"} onClick={() => setMode("grow")}>Grow</button></div>
          <div className="task-composer" id="chat">
            {conversation.length > 0
              ? <div className="task-conversation" aria-live="polite">{conversation.map((message, index) => <article className={`task-chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "HelloAI" : "You"}</span><p>{message.role === "assistant" ? renderChatMessage(message.content) : message.content}</p></article>)}</div>
              : <div className="task-chat-welcome"><span className="task-chat-avatar">H</span><div><strong>Hello, I’m HelloAI.</strong><p>Ask me a question, share an idea, or tell me what you’re working on.</p></div></div>}
            {isThinking && <p className="task-chat-thinking" role="status">HelloAI is thinking…</p>}
            <textarea aria-label="Message HelloAI" value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} placeholder="Message HelloAI about anything..." />
            {agentMessage && <p className="task-agent-message" role="status">{agentMessage}</p>}
            {agentError && <div className="task-agent-error" role="alert">{agentError}</div>}
            {conversationNotice && <p className="task-chat-notice" role="status">{conversationNotice}</p>}
            <div className="task-composer-footer">
              <span className="task-save-explainer">Chats are not saved unless you choose to save them.</span>
              {conversation.length > 0 && <button className="task-reset-conversation" type="button" onClick={startNewConversation}>New chat</button>}
              {conversation.length > 0 && (chatUserId
                ? <button className="task-save-conversation" type="button" onClick={() => void saveConversation()} disabled={isSavingConversation}>{isSavingConversation ? "Saving..." : activeConversationId ? "Save changes" : "Save conversation"}</button>
                : <Link className="task-auth-link" href="/login">Sign in to save</Link>)}
              {canPrepareWebsitePlan && <button className="task-plan-button" type="button" onClick={() => void createPlan()} disabled={isPlanning || !agentAccessToken}>{isPlanning ? "Preparing..." : "Prepare website plan"}</button>}
              <button className="task-submit" type="button" aria-label="Send message to HelloAI" onClick={() => void submitTask()} disabled={!task.trim() || isThinking}>{isThinking ? "…" : "→"}</button>
            </div>
          </div>
          <nav className="hello-home-quick-actions" aria-label="Quick actions">
            {mode === "build"
              ? quickActions.map((action) => action.href === "#search"
                ? <button className="hello-home-action" key={action.label} type="button" onClick={() => setSearchOpen(true)}><span>{action.icon}</span>{action.label}</button>
                : <Link className="hello-home-action" key={action.label} href={action.href}><span>{action.icon}</span>{action.label}</Link>)
              : growQuickActions.map((action) => <button className="hello-home-action" key={action.label} type="button" onClick={() => selectGrowPrompt(action.prompt)}><span>{action.icon}</span>{action.label}</button>)}
          </nav>
          <details className="task-saved-conversations" id="saved-chats">
            <summary>Saved chats ({savedConversations.length}){savedConversations.length > 0 && " — select a chat to open or delete it"}</summary>
            {conversationNotice.startsWith("Saved chats are unavailable") && <p className="task-chat-notice" role="status">{conversationNotice}</p>}
            {savedConversations.length > 0
              ? <><div className="task-saved-chat-list">{savedConversations.map((saved) => <div className="task-saved-chat" key={saved.id}><button type="button" onClick={() => openSavedConversation(saved)}><strong>{saved.title}</strong><small>Saved {new Date(saved.updated_at).toLocaleDateString()}</small></button><button className="task-delete-chat" type="button" aria-label={`Delete saved chat ${saved.title}`} onClick={() => void deleteSavedConversation(saved.id)}>Delete</button></div>)}</div><button className="task-delete-all-chats" type="button" onClick={() => void deleteAllSavedConversations()}>Delete all saved chats</button></>
              : <p className="task-chat-notice">Saved conversations will appear here. Nothing is stored until you select “Save conversation”.</p>}
          </details>
        </section>

        <section className="task-agent-history" id="agent-runs" aria-labelledby="agent-history-heading">
          <div className="task-agent-history-heading"><div><span className="eyebrow">AGENT RUNS</span><h2 id="agent-history-heading">Saved plans</h2></div><span>{agentRuns.length} / 20</span></div>
          {agentRuns.length === 0 ? <p className="task-agent-empty">{agentError || agentMessage || "Sign in to create and keep task plans."} {!agentAccessToken && supabase && <Link href="/login">Sign in →</Link>}</p> : <div className="task-agent-history-layout">
            <div className="task-agent-run-list">{agentRuns.map((run) => <div className={run.id === selectedRun?.id ? "task-agent-run-row selected" : "task-agent-run-row"} key={run.id}><button className="task-agent-run" type="button" onClick={() => setSelectedRunId(run.id)}><span>{run.goal}</span><small><b>{run.status}</b> · {new Date(run.createdAt).toLocaleDateString()}</small></button><button className="task-delete-chat task-delete-run" type="button" disabled={!agentAccessToken || deletingRunId === run.id || run.status === "queued" || run.status === "running"} aria-label={`Delete saved plan ${run.goal}`} title={run.status === "queued" || run.status === "running" ? "Cancel and wait for this run to stop before deleting" : "Delete saved plan"} onClick={() => void deleteAgentRun(run)}>{deletingRunId === run.id ? "Deleting..." : "Delete"}</button></div>)}</div>
            {selectedRun && <article className="task-agent-run-detail"><div className="task-agent-run-title"><h3>{selectedRun.goal}</h3><span className="task-agent-status">{selectedRun.status}</span></div><p className="task-agent-notice">{selectedRun.status === "planned" ? "Nothing has been generated yet. Approving starts website draft generation; it will not publish the site." : selectedRun.status === "queued" || selectedRun.status === "running" ? "The background worker is processing this task." : selectedRun.status === "completed" ? "Verified website draft saved in this run." : selectedRun.status === "failed" ? "The task failed; see the error below." : selectedRun.status === "cancelled" ? "This run was cancelled." : `Run status: ${selectedRun.status}.`}</p>{selectedRun.status === "planned" && <button className="primary-button" type="button" disabled={actingRunId === selectedRun.id} onClick={() => void updateRun(selectedRun, "start")}>{actingRunId === selectedRun.id ? "Starting..." : "Approve & generate draft"}</button>}{(selectedRun.status === "queued" || selectedRun.status === "running") && <button className="secondary-button" type="button" disabled={actingRunId === selectedRun.id || selectedRun.cancelRequested} onClick={() => void updateRun(selectedRun, "cancel")}>{selectedRun.cancelRequested ? "Cancellation requested" : actingRunId === selectedRun.id ? "Cancelling..." : "Cancel run"}</button>}<strong>Success criteria</strong><ul>{selectedRun.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><strong>Planned steps</strong><ol>{selectedRun.tasks.map((agentTask) => <li key={agentTask.key}><span>{agentTask.title}</span><small>{agentTask.toolName} · {agentTask.status}{agentTask.requiresApproval ? " · approval required" : ""}</small>{agentTask.errorMessage && <small className="task-agent-run-error">{agentTask.errorMessage}</small>}{agentTask.evidence && <small>Verified {agentTask.evidence.pageCount} pages; home page {agentTask.evidence.hasHomePage ? "present" : "missing"}.</small>}{agentTask.result?.pages && <ul className="task-agent-page-results">{agentTask.result.pages.map((page) => <li key={page.slug}>{page.label}: {page.title}</li>)}</ul>}</li>)}</ol></article>}
          </div>}
        </section>

      </section>
      {searchOpen && <div className="task-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="task-search-dialog" role="dialog" aria-modal="true" aria-label="Search HelloAI"><div className="task-search-input-wrap"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search HelloAI" /><kbd>Esc</kbd></div><div className="task-search-results">{searchItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => <Link key={item.label} href={item.href} onClick={() => setSearchOpen(false)}><span>→</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></Link>)}{searchItems.every((item) => !`${item.label} ${item.detail}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p className="task-search-empty">No matching HelloAI feature found.</p>}</div></section></div>}
    </main>
  );
}
