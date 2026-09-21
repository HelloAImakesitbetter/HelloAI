"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function LiveAgent() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Tell me what you want to grow. I can recommend the best next website, SEO, or conversion action." },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [site, setSite] = useState("");

  useEffect(() => {
    setSite(window.localStorage.getItem("helloai-seo-connected-site") || "");
  }, []);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          businessName: window.localStorage.getItem("helloai-website-draft") || "",
          description: site ? `Connected website: ${site}` : "No website connected yet",
          progress: `live agent on ${window.location.pathname}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The live agent could not respond");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The live agent is unavailable right now." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {open && <section className="live-agent-panel" aria-label="HelloAI live agent">
        <header><div><span className="eyebrow">HELLOAI LIVE AGENT</span><strong>Growth recommendations</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close agent">×</button></header>
        <div className="live-agent-thread">{messages.map((message, index) => <div className={`live-agent-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "✦" : "You"}</span><p>{message.content}</p></div>)}{isSending && <div className="live-agent-message assistant"><span>✦</span><p>Reviewing the best next move...</p></div>}</div>
        <form onSubmit={sendMessage}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="What should I do next?" aria-label="Message live agent" /><button type="submit" disabled={isSending || !input.trim()} aria-label="Send message">↑</button></form>
      </section>}
      <button className={`live-agent-launcher ${open ? "active" : ""}`} type="button" onClick={() => setOpen((current) => !current)} aria-label="Open HelloAI live agent"><span>✦</span><b>{open ? "Close" : "Ask HelloAI"}</b></button>
    </>
  );
}
