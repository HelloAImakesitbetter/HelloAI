"use client";

import { useEffect, useState } from "react";

type Scene = {
  scene: number;
  imagePrompt: string;
  imageUrl: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
type Character = { name: string; avatarId: string; voiceId: string };

export default function Home() {
  const [result, setResult] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [aiVideoUrl, setAiVideoUrl] = useState("");
  const [aiVideoStatus, setAiVideoStatus] = useState("");
  const [isGeneratingAiVideo, setIsGeneratingAiVideo] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    const savedProject = window.localStorage.getItem("helloai-project");

    if (savedProject) {
      const project = JSON.parse(savedProject) as {
        businessName?: string;
        description?: string;
        chatMessages?: ChatMessage[];
      };
      setBusinessName(project.businessName || "");
      setDescription(project.description || "");
      setChatMessages(project.chatMessages || []);
    }
    const savedCharacters = window.localStorage.getItem("helloai-characters");
    if (savedCharacters) setCharacters(JSON.parse(savedCharacters));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "helloai-project",
      JSON.stringify({ businessName, description, chatMessages })
    );
  }, [businessName, description, chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessName, description }),
      });
      const responseText = await response.text();
      let data: { script?: string; error?: string };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `The API returned an invalid response (${response.status})`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate script");
      }

      if (!data.script) {
        throw new Error("The API response did not include a script");
      }

      setResult(data.script);
      setScenes([]);
      setVideoUrl("");
      setAiVideoUrl("");
      setAiVideoStatus("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate script"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiVideo = async () => {
    if (!result) {
      return;
    }

    setIsGeneratingAiVideo(true);
    setAiVideoStatus("Submitting video job...");
    setError("");

    try {
      const response = await fetch("/api/ai-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, description, script: result, scenes, characters }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start AI video generation");
      }

      if (!Array.isArray(data.ids) || data.ids.length === 0) {
        throw new Error("The video service did not return any jobs");
      }

      const provider = data.provider || "runway";
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusResponse = await fetch(
          `/api/ai-video/status?provider=${encodeURIComponent(provider)}&ids=${encodeURIComponent(data.ids.join(","))}`
        );
        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusData.error || "Failed to check video status");
        }

        setAiVideoStatus(
          statusData.status === "completed"
            ? "Video ready"
            : provider === "heygen"
              ? "Animating characters and recording voices..."
              : `Creating moving video... ${statusData.progress || 0}%`
        );

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "AI video generation failed");
        }

        if (statusData.status === "completed") {
          const downloadResponse = await fetch("/api/ai-video/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: data.ids, script: result, provider }),
          });

          if (!downloadResponse.ok) {
            const downloadData = await downloadResponse.json().catch(() => null);
            throw new Error(downloadData?.error || "Failed to download AI video");
          }

          const warning = downloadResponse.headers.get("X-HelloAI-Warning");
          setAiVideoUrl(URL.createObjectURL(await downloadResponse.blob()));
          setAiVideoStatus(warning || "Video ready");
          return;
        }
      }

      throw new Error("Video generation timed out. Please try again.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate AI video"
      );
      setAiVideoStatus("");
    } finally {
      setIsGeneratingAiVideo(false);
    }
  };

  const generateScenes = async () => {
    if (!result) {
      return;
    }

    setIsGeneratingScenes(true);
    setError("");

    try {
      const response = await fetch("/api/scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: result }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate scenes");
      }

      setScenes(data.scenes);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate scenes"
      );
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const sendChatMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = chatInput.trim();

    if (!content || isChatting) {
      return;
    }

    const nextMessages = [...chatMessages, { role: "user" as const, content }];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatting(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          businessName,
          description,
          progress: `${result ? "script" : "brief"}${scenes.length === 3 ? ", scenes" : ""}${aiVideoUrl || videoUrl ? ", video" : ""}`,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to answer");
      }

      setChatMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to answer");
    } finally {
      setIsChatting(false);
    }
  };

  const completedSteps = [
    Boolean(result),
    scenes.length === 3,
    Boolean(aiVideoUrl || videoUrl),
  ].filter(Boolean).length;

  return (
    <main className="command-shell">
      <aside className="command-sidebar">
        <div className="brand-mark"><span>H</span><strong>HelloAI</strong></div>
        <button className="new-project" type="button" onClick={() => window.location.reload()}><span>+</span> New workspace</button>
        <p className="sidebar-label">Command center</p>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <button className="nav-item active" type="button"><span>⌂</span> Overview</button>
          <a className="nav-item" href="/video"><span>▶</span> Video studio</a>
          <a className="nav-item" href="#build"><span>✦</span> Build something</a>
          <a className="nav-item" href="/website"><span>▤</span> Website builder</a>
          <a className="nav-item" href="/seo"><span>⌕</span> SEO growth</a>
          <a className="nav-item" href="/image"><span>▧</span> Image studio</a>
          <a className="nav-item" href="/characters"><span>◉</span> Characters</a>
          <button className="nav-item" type="button"><span>◫</span> Projects</button>
          <button className="nav-item" type="button"><span>◌</span> Assets</button>
        </nav>
        <div className="sidebar-footer"><div className="user-avatar">A</div><div><strong>Adam</strong><span>Personal workspace</span></div><span className="more-icon">•••</span></div>
      </aside>

      <section className="command-main">
        <header className="command-header">
          <div><span className="eyebrow">PERSONAL WORKSPACE / TODAY</span><h1>Good morning, Adam.</h1><p>Turn the next good idea into something your business can use.</p></div>
          <div className="header-actions"><span className="status-dot">● Systems ready</span><button className="icon-button" type="button" aria-label="More options">•••</button></div>
        </header>

        <section className="command-stats" aria-label="Workspace summary">
          <div><span className="stat-label">Active project</span><strong>{businessName || "Your next business idea"}</strong><small>{result ? "Draft in progress" : "Waiting for a brief"}</small></div>
          <div><span className="stat-label">Assets created</span><strong>{(result ? 1 : 0) + scenes.length + (aiVideoUrl || videoUrl ? 1 : 0)}</strong><small>Across this workspace</small></div>
          <div><span className="stat-label">Project progress</span><strong>{completedSteps}/3</strong><small>{completedSteps === 3 ? "Ready to share" : "Keep building"}</small></div>
        </section>

        <section className="command-grid" id="build">
          <div className="command-primary">
            <div className="command-intro"><div><span className="eyebrow">BUILD WITH HELLOAI</span><h2>What are we making?</h2><p>Describe a business goal and HelloAI will turn it into a plan, content, and a finished deliverable.</p></div><span className="intro-mark">✦</span></div>
            <form onSubmit={handleSubmit} className="command-form">
              <label>Business or project name<input type="text" placeholder="e.g. HellowClean" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
              <label>Your goal<textarea placeholder="Launch a local cleaning service with a warm video, a simple website, and a clear offer..." value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <div className="form-footer"><span className="field-hint">{description.length}/500 characters</span><button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Building..." : "Build the plan  →"}</button></div>
            </form>
            {error && <div className="error-banner">{error}</div>}
          </div>
          <aside className="command-assistant">
            <div className="assistant-topline"><div className="assistant-avatar">✦</div><div><span className="eyebrow">HELLOAI AGENT</span><h2>Ask for the next move</h2></div></div>
            <div className="chat-thread">{chatMessages.length === 0 ? <p className="chat-empty">I can shape an idea, improve your offer, or help decide what to build next.</p> : chatMessages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "✦" : "You"}</span><p>{message.content}</p></div>)}{isChatting && <div className="chat-message assistant"><span>✦</span><p className="typing-indicator">Thinking...</p></div>}</div>
            <form className="chat-form" onSubmit={sendChatMessage}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask HelloAI..." aria-label="Ask HelloAI" /><button type="submit" disabled={isChatting || !chatInput.trim()} aria-label="Send message">↑</button></form>
          </aside>
        </section>

        {result ? <section className="project-board"><div className="board-heading"><div><span className="eyebrow">ACTIVE PROJECT</span><h2>{businessName || "Untitled project"}</h2></div><span className="draft-pill">In progress</span></div><div className="project-board-grid"><div><pre className="script-preview">{result}</pre><div className="tool-row"><button type="button" onClick={generateScenes} disabled={isGeneratingScenes} className="secondary-button">▧ {isGeneratingScenes ? "Creating scenes..." : "Create scenes"}</button><a href="/video" className="primary-button small">Open Video Studio →</a><a href="/seo" className="secondary-button">Plan SEO →</a></div>{aiVideoStatus && <div className="progress-note">{aiVideoStatus}</div>}</div><div className="project-steps"><div className={result ? "plan-step done" : "plan-step current"}><span>01</span><div><strong>Shape the idea</strong><small>Script generated</small></div><b>✓</b></div><div className={scenes.length === 3 ? "plan-step done" : "plan-step"}><span>02</span><div><strong>Set the scene</strong><small>{scenes.length === 3 ? "Three scenes ready" : "Create visual direction"}</small></div><b>{scenes.length === 3 ? "✓" : "·"}</b></div><div className={aiVideoUrl || videoUrl ? "plan-step done" : "plan-step"}><span>03</span><div><strong>Make it talk</strong><small>{aiVideoUrl || videoUrl ? "Lip-synced video ready" : "Open Video Studio"}</small></div><b>{aiVideoUrl || videoUrl ? "✓" : "·"}</b></div></div></div></section> : <section className="next-actions"><div><span className="eyebrow">START HERE</span><h2>One brief can become a whole business kit.</h2><p>Begin with the idea above, then use the workspace to create the pieces around it.</p></div><div className="action-links"><a href="/video"><span>▶</span><strong>Make a video</strong><small>Turn the offer into a talking production.</small></a><a href="/website"><span>▤</span><strong>Build a website</strong><small>Turn the offer into a home online.</small></a><a href="/seo"><span>⌕</span><strong>Grow with SEO</strong><small>Find what customers are searching for.</small></a></div></section>}

        {scenes.length > 0 && <section className="scenes-section"><div className="section-heading"><div><span className="eyebrow">VISUAL DIRECTION</span><h2>Scene board</h2></div><span className="count-pill">{scenes.length} scenes</span></div><div className="scene-grid">{scenes.map((scene) => <article key={scene.scene} className="scene-card"><img src={scene.imageUrl} alt={`Scene ${scene.scene}`} /><div className="scene-copy"><span>0{scene.scene}</span><h3>Scene {scene.scene}</h3><p>{scene.imagePrompt}</p></div></article>)}</div></section>}
        {(videoUrl || aiVideoUrl) && <section className="finished-card"><div className="section-heading"><div><span className="eyebrow">DELIVERABLE</span><h2>Ready to share</h2></div><span className="ready-pill">● Ready</span></div><video controls src={aiVideoUrl || videoUrl} /><a href={aiVideoUrl || videoUrl} download={aiVideoUrl ? "ai-business-video.mp4" : "business-video.mp4"} className="primary-button download-button">Download final MP4  ↓</a></section>}
      </section>
    </main>
  );
}