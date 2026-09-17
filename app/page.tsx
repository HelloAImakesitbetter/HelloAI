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

export default function Home() {
  const [result, setResult] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [aiVideoUrl, setAiVideoUrl] = useState("");
  const [aiVideoStatus, setAiVideoStatus] = useState("");
  const [isGeneratingAiVideo, setIsGeneratingAiVideo] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);

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
      setAudioDataUrl("");
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
    if (!result || scenes.length === 0) {
      return;
    }

    setIsGeneratingAiVideo(true);
    setAiVideoStatus("Submitting video job...");
    setError("");

    try {
      const response = await fetch("/api/ai-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, script: result, scenes }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start AI video generation");
      }

      if (!Array.isArray(data.ids) || data.ids.length === 0) {
        throw new Error("The video service did not return any jobs");
      }

      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusResponse = await fetch(
          `/api/ai-video/status?ids=${encodeURIComponent(data.ids.join(","))}`
        );
        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusData.error || "Failed to check video status");
        }

        setAiVideoStatus(
          statusData.status === "completed"
            ? "Video ready"
            : `Creating moving video... ${statusData.progress || 0}%`
        );

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "AI video generation failed");
        }

        if (statusData.status === "completed") {
          const downloadResponse = await fetch("/api/ai-video/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: data.ids, audioDataUrl }),
          });

          if (!downloadResponse.ok) {
            const downloadData = await downloadResponse.json().catch(() => null);
            throw new Error(downloadData?.error || "Failed to download AI video");
          }

          setAiVideoUrl(URL.createObjectURL(await downloadResponse.blob()));
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

  const generateVoice = async () => {
    if (!result) {
      return;
    }

    setError("");

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script: result }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate voiceover");
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      const blob = await response.blob();
      const audioData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read voiceover"));
        reader.readAsDataURL(blob);
      });

      setAudioUrl(URL.createObjectURL(blob));
      setAudioDataUrl(audioData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate voiceover"
      );
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

  const createVideo = async () => {
    if (scenes.length !== 3 || !audioDataUrl) {
      return;
    }

    setIsCreatingVideo(true);
    setError("");

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenes, audioDataUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to create video");
      }

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoUrl(URL.createObjectURL(await response.blob()));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create video"
      );
    } finally {
      setIsCreatingVideo(false);
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
          progress: `${result ? "script" : "brief"}${audioUrl ? ", voice" : ""}${scenes.length === 3 ? ", scenes" : ""}${aiVideoUrl || videoUrl ? ", video" : ""}`,
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
    Boolean(audioUrl),
    scenes.length === 3,
    Boolean(aiVideoUrl || videoUrl),
  ].filter(Boolean).length;

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="brand-mark"><span>H</span><strong>HelloAI</strong></div>
        <button className="new-project" type="button" onClick={() => window.location.reload()}>
          <span>+</span> New project
        </button>
        <p className="sidebar-label">Workspace</p>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <button className="nav-item active" type="button"><span>✦</span> Create</button>
          <button className="nav-item" type="button"><span>◫</span> Projects</button>
          <button className="nav-item" type="button"><span>◌</span> Assets</button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">A</div>
          <div><strong>Adam</strong><span>Personal workspace</span></div>
          <span className="more-icon">•••</span>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div><span className="eyebrow">CREATE / VIDEO PROJECT</span><h1>Make something people remember.</h1></div>
          <div className="header-actions"><span className="status-dot">● All systems ready</span><button className="icon-button" type="button" aria-label="More options">•••</button></div>
        </header>

        <div className="workspace-grid">
          <section className="creation-column">
            <div className="brief-card">
              <div className="card-kicker"><span className="kicker-icon">✦</span> Project brief</div>
              <p className="card-intro">Tell the assistant what you want to make. It will turn the idea into a script, scenes, voice, and video.</p>
              <form onSubmit={handleSubmit} className="brief-form">
                <label>Business or project name<input type="text" placeholder="e.g. HellowClean" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
                <label>What should we create?<textarea placeholder="Describe the business, audience, offer, and feeling you want the video to have..." value={description} onChange={(e) => setDescription(e.target.value)} /></label>
                <div className="form-footer"><span className="field-hint">{description.length}/500 characters</span><button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Thinking..." : "Build the plan  →"}</button></div>
              </form>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {result ? (
              <section className="assistant-card">
                <div className="assistant-heading"><div className="assistant-avatar">✦</div><div><span className="eyebrow">HELLOAI / ASSISTANT</span><h2>Your first draft is ready</h2></div><span className="draft-pill">Draft 01</span></div>
                <pre className="script-preview">{result}</pre>
                <div className="tool-row">
                  <button type="button" onClick={generateVoice} className="secondary-button" disabled={Boolean(audioUrl)}>◉ {audioUrl ? "Voice ready" : "Generate voice"}</button>
                  <button type="button" onClick={generateScenes} disabled={isGeneratingScenes} className="secondary-button">▧ {isGeneratingScenes ? "Creating scenes..." : "Create scenes"}</button>
                  <button type="button" onClick={generateAiVideo} disabled={isGeneratingAiVideo || scenes.length === 0} className="primary-button small">{isGeneratingAiVideo ? "Rendering..." : "Generate moving video  →"}</button>
                </div>
                {audioUrl && <audio controls className="audio-player"><source src={audioUrl} type="audio/mpeg" /></audio>}
                {aiVideoStatus && <div className="progress-note">{aiVideoStatus}</div>}
              </section>
            ) : (
              <div className="empty-state"><div className="empty-orbit">✦</div><h2>Your project will take shape here.</h2><p>Start with a simple brief and HelloAI will map the work into useful next steps.</p></div>
            )}

            {scenes.length > 0 && <section className="scenes-section"><div className="section-heading"><div><span className="eyebrow">VISUAL DIRECTION</span><h2>Scene board</h2></div><span className="count-pill">{scenes.length} scenes</span></div><div className="scene-grid">{scenes.map((scene) => <article key={scene.scene} className="scene-card"><img src={scene.imageUrl} alt={`Scene ${scene.scene}`} /><div className="scene-copy"><span>0{scene.scene}</span><h3>Scene {scene.scene}</h3><p>{scene.imagePrompt}</p></div></article>)}</div></section>}

            {(videoUrl || aiVideoUrl) && <section className="finished-card"><div className="section-heading"><div><span className="eyebrow">DELIVERABLE</span><h2>Ready to share</h2></div><span className="ready-pill">● Ready</span></div><video controls src={aiVideoUrl || videoUrl} /><a href={aiVideoUrl || videoUrl} download={aiVideoUrl ? "ai-business-video.mp4" : "business-video.mp4"} className="primary-button download-button">Download final MP4  ↓</a></section>}
          </section>

          <aside className="activity-column">
            <div className="activity-card"><div className="section-heading"><div><span className="eyebrow">PROJECT PULSE</span><h2>Build plan</h2></div><span className="progress-number">{completedSteps}/4</span></div><div className="plan-list"><div className={result ? "plan-step done" : "plan-step current"}><span>01</span><div><strong>Shape the idea</strong><small>{result ? "Script generated" : "Waiting for your brief"}</small></div><b>{result ? "✓" : "·"}</b></div><div className={audioUrl ? "plan-step done" : "plan-step"}><span>02</span><div><strong>Give it a voice</strong><small>{audioUrl ? "Voiceover ready" : "Generate narration"}</small></div><b>{audioUrl ? "✓" : "·"}</b></div><div className={scenes.length === 3 ? "plan-step done" : "plan-step"}><span>03</span><div><strong>Set the scene</strong><small>{scenes.length === 3 ? "Three scenes ready" : "Create visual direction"}</small></div><b>{scenes.length === 3 ? "✓" : "·"}</b></div><div className={aiVideoUrl || videoUrl ? "plan-step done" : "plan-step"}><span>04</span><div><strong>Make it move</strong><small>{aiVideoUrl || videoUrl ? "Final MP4 ready" : "Render the video"}</small></div><b>{aiVideoUrl || videoUrl ? "✓" : "·"}</b></div></div></div>
            <div className="chat-card">
              <div className="section-heading"><div><span className="eyebrow">PROJECT ASSISTANT</span><h2>Ask HelloAI</h2></div><span className="chat-spark">✦</span></div>
              <div className="chat-thread">
                {chatMessages.length === 0 ? <p className="chat-empty">Ask for ideas, a stronger hook, or the next step in this project.</p> : chatMessages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "✦" : "You"}</span><p>{message.content}</p></div>)}
                {isChatting && <div className="chat-message assistant"><span>✦</span><p className="typing-indicator">Thinking...</p></div>}
              </div>
              <form className="chat-form" onSubmit={sendChatMessage}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask your assistant..." aria-label="Ask HelloAI" /><button type="submit" disabled={isChatting || !chatInput.trim()} aria-label="Send message">↑</button></form>
            </div>
            <div className="tip-card"><span className="tip-symbol">↗</span><div><strong>Good to know</strong><p>Specific details create stronger scripts, scenes, and characters.</p></div></div>
          </aside>
        </div>
      </section>
    </main>
  );
}