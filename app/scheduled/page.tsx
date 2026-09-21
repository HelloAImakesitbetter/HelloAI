"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TaskStatus = "active" | "paused" | "completed";
type ScheduledTask = { id: string; name: string; prompt: string; cadence: string; nextRun: string; status: TaskStatus; lastRun: string; runs: number };

const starterTasks: ScheduledTask[] = [
  { id: "weekly-seo", name: "Weekly SEO health check", prompt: "Audit my connected website and summarize the highest-impact SEO issues.", cadence: "Every Monday at 09:00", nextRun: "Monday at 09:00", status: "active", lastRun: "Not run yet", runs: 0 },
  { id: "monthly-content", name: "Monthly content plan", prompt: "Create four SEO blog briefs based on my current growth opportunities.", cadence: "1st of every month", nextRun: "1st of next month", status: "active", lastRun: "Not run yet", runs: 0 },
];

export default function ScheduledPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadence, setCadence] = useState("Every Monday at 09:00");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("helloai-scheduled-tasks");
    setTasks(saved ? JSON.parse(saved) : starterTasks);
  }, []);

  useEffect(() => {
    if (tasks.length) window.localStorage.setItem("helloai-scheduled-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(() => tasks.filter((task) => (filter === "all" || task.status === filter) && `${task.name} ${task.prompt}`.toLowerCase().includes(query.toLowerCase())), [tasks, filter, query]);

  const createTask = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    setTasks((current) => [{ id: crypto.randomUUID(), name: name.trim(), prompt: prompt.trim(), cadence, nextRun: cadence, status: "active", lastRun: "Not run yet", runs: 0 }, ...current]);
    setName(""); setPrompt(""); setShowCreate(false); setNotice("Scheduled task created.");
  };

  const updateTask = (id: string, update: Partial<ScheduledTask>) => setTasks((current) => current.map((task) => task.id === id ? { ...task, ...update } : task));
  const runNow = (task: ScheduledTask) => { updateTask(task.id, { lastRun: "Just now", runs: task.runs + 1, nextRun: task.cadence }); setNotice(`Queued: ${task.name}. Open the SEO or website workspace to review its output.`); };

  return <main className="scheduled-shell"><aside className="task-workspace-sidebar"><div className="task-brand"><span>H</span><strong>HelloAI</strong></div><a className="task-search" href="/">← Back to workspace</a><a className="task-new-button" href="/website">＋ New task</a><nav className="task-nav"><a href="/">⌂ <span>Home</span></a><a href="/website">▤ <span>Website Builder</span></a><a href="/seo">⌕ <span>SEO Engine</span></a><a className="selected" href="/scheduled">◷ <span>Scheduled</span></a><a href="/seo">⌘ <span>Plugins</span></a></nav><div className="task-account"><span>A</span><div><strong>Account</strong><small>Personal workspace</small></div></div></aside><section className="scheduled-main"><header className="scheduled-header"><div><span className="eyebrow">AUTOPILOT / SCHEDULED</span><h1>Scheduled tasks</h1><p>Set recurring SEO, content, audit, and growth work. HelloAI will keep the plan moving.</p></div><button className="primary-button" type="button" onClick={() => setShowCreate(true)}>Create task ⌄</button></header>{notice && <div className="success-banner">{notice}</div>}<div className="scheduled-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scheduled tasks" /><div className="scheduled-filters">{(["all", "active", "paused", "completed"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div>{showCreate && <form className="scheduled-create" onSubmit={createTask}><span className="eyebrow">NEW AUTOPILOT TASK</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Task name" required /><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should HelloAI do? e.g. Audit my site and recommend pages to build." required /><select value={cadence} onChange={(event) => setCadence(event.target.value)}><option>Every weekday at 09:00</option><option>Every Monday at 09:00</option><option>Every Friday at 16:00</option><option>1st of every month</option><option>Custom monthly review</option></select><div><button className="primary-button" type="submit">Save task</button><button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>Cancel</button></div></form>}{visibleTasks.length === 0 ? <div className="scheduled-empty"><span>◷</span><h2>No scheduled tasks yet</h2><p>Schedule a task and HelloAI will run the workflow for you automatically.</p><button className="secondary-button" type="button" onClick={() => setShowCreate(true)}>New task</button></div> : <div className="scheduled-list">{visibleTasks.map((task) => <article className="scheduled-card" key={task.id}><div className="scheduled-card-icon">◷</div><div className="scheduled-card-content"><div className="scheduled-card-title"><h2>{task.name}</h2><span className={`scheduled-status ${task.status}`}>{task.status}</span></div><p>{task.prompt}</p><div className="scheduled-card-meta"><span>{task.cadence}</span><span>Next: {task.nextRun}</span><span>{task.runs} runs</span></div></div><div className="scheduled-card-actions"><button type="button" onClick={() => runNow(task)}>Run now</button>{task.status === "active" ? <button type="button" onClick={() => updateTask(task.id, { status: "paused" })}>Pause</button> : <button type="button" onClick={() => updateTask(task.id, { status: "active" })}>Resume</button>}<button type="button" onClick={() => updateTask(task.id, { status: "completed" })}>Complete</button></div></article>)}</div>}</section></main>;
}
