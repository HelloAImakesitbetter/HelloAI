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
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

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
      const savedDraft = window.localStorage.getItem("helloai-website-draft");
      let businessName = "HelloAI customer";
      let businessDescription = "No business brief provided yet.";
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as { businessName?: string; description?: string };
          businessName = parsed.businessName?.slice(0, 160) || businessName;
          businessDescription = parsed.description?.slice(0, 1200) || businessDescription;
        } catch {
          // Ignore stale browser data and keep a compact context.
        }
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          businessName,
          description: `${businessDescription}${site ? `\nConnected website: ${site}` : "\nNo website connected yet"}`.slice(0, 1600),
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

  const speak = (content: string, index: number) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      {open && <section className="live-agent-panel" aria-label="HelloAI live agent">
        <header><div><span className="eyebrow">HELLOAI LIVE AGENT</span><strong>Growth recommendations</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close agent">×</button></header>
        <div className="live-agent-thread">{messages.map((message, index) => <div className={`live-agent-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "✦" : "You"}</span><div><p>{message.content}</p>{message.role === "assistant" && <button type="button" className="live-agent-speak" onClick={() => speak(message.content, index)}>{speakingIndex === index ? "Stop speaking" : "Speak this reply"}</button>}</div></div>)}{isSending && <div className="live-agent-message assistant"><span>✦</span><p>Reviewing the best next move...</p></div>}</div>
        <form onSubmit={sendMessage}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="What should I do next?" aria-label="Message live agent" /><button type="submit" disabled={isSending || !input.trim()} aria-label="Send message">↑</button></form>
      </section>}
      <button className={`live-agent-launcher ${open ? "active" : ""}`} type="button" onClick={() => setOpen((current) => !current)} aria-label="Open HelloAI live agent"><span>✦</span><b>{open ? "Close" : "Ask HelloAI"}</b></button>
    </>
  );
}
