"use client";

import { useEffect, useState } from "react";

type Scene = { scene: number; imagePrompt: string; imageUrl: string };
type Character = { name: string; avatarId: string; voiceId: string };

type Stage = "brief" | "script" | "storyboard" | "render" | "ready";

export default function VideoStudioPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [stage, setStage] = useState<Stage>("brief");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const savedCharacters = window.localStorage.getItem("helloai-characters");
    if (savedCharacters) setCharacters(JSON.parse(savedCharacters) as Character[]);
  }, []);

  const request = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The video studio request failed");
    return data;
  };

  const buildScript = async () => {
    setIsWorking(true);
    setError("");
    setStatus("Writing the dialogue...");
    try {
      const data = await request("/api/generate", { businessName, description });
      setScript(data.script);
      setStage("script");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to write the script");
    } finally {
      setIsWorking(false);
      setStatus("");
    }
  };

  const buildStoryboard = async () => {
    setIsWorking(true);
    setError("");
    setStatus("Designing the storyboard and visual direction...");
    try {
      const data = await request("/api/scenes", { script, businessName, description });
      setScenes(data.scenes);
      setStage("storyboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create the storyboard");
    } finally {
      setIsWorking(false);
      setStatus("");
    }
  };

  const renderVideo = async () => {
    setIsWorking(true);
    setError("");
    setStage("render");
    setStatus("Animating the cast and recording their voices...");
    try {
      const job = await request("/api/ai-video", { businessName, description, script, scenes, characters });
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const response = await fetch(`/api/ai-video/status?provider=${encodeURIComponent(job.provider)}&ids=${encodeURIComponent(job.ids.join(","))}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to check render status");
        if (data.status === "failed") throw new Error(data.error || "Video rendering failed");
        if (data.status === "completed") {
          const download = await fetch("/api/ai-video/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: job.ids }),
          });
          if (!download.ok) {
            const downloadData = await download.json().catch(() => null);
            throw new Error(downloadData?.error || "The finished video could not be downloaded");
          }
          setVideoUrl(URL.createObjectURL(await download.blob()));
          setStage("ready");
          setStatus("Your talking video is ready.");
          return;
        }
        setStatus(`Rendering your video${data.progress ? `... ${data.progress}%` : "..."}`);
      }
      throw new Error("Rendering timed out. Please try again.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to render the video");
      setStage("storyboard");
      setStatus("");
    } finally {
      setIsWorking(false);
    }
  };

  const resetStudio = () => {
    setBusinessName("");
    setDescription("");
    setScript("");
    setScenes([]);
    setVideoUrl("");
    setStage("brief");
    setStatus("");
    setError("");
  };

  return (
    <main className="video-studio-shell">
      <header className="video-studio-header">
        <a href="/" className="back-link">← HelloAI</a>
        <div className="studio-brand"><span className="eyebrow">VIDEO STUDIO</span><strong>{businessName || "Untitled production"}</strong></div>
        <button type="button" className="secondary-button" onClick={resetStudio}>New video</button>
      </header>
      <div className="video-studio-layout">
        <aside className="video-studio-rail">
          <div className="studio-rail-heading"><span className="eyebrow">PRODUCTION</span><span>{stage === "ready" ? "Complete" : "In progress"}</span></div>
          {[['brief', '01', 'The brief'], ['script', '02', 'The script'], ['storyboard', '03', 'Storyboard'], ['render', '04', 'Render'], ['ready', '05', 'Final video']].map(([key, number, label]) => <div className={`studio-step ${stage === key ? "current" : ""} ${["script", "storyboard", "render", "ready"].indexOf(stage) > ["brief", "script", "storyboard", "render", "ready"].indexOf(key) ? "done" : ""}`} key={key}><span>{number}</span><div><strong>{label}</strong><small>{key === "brief" ? "Set the direction" : key === "script" ? "Give it a voice" : key === "storyboard" ? "Plan each shot" : key === "render" ? "Animate the cast" : "Ready to share"}</small></div><b>{stage === key ? "●" : ""}</b></div>)}
          <div className="studio-tip"><strong>Studio note</strong><p>Saved characters are matched to the names in your dialogue and speak with their selected HeyGen voices.</p><a href="/characters">Manage your cast →</a></div>
        </aside>
        <section className="video-studio-main">
          <div className="studio-title"><div><span className="eyebrow">FROM IDEA TO VIDEO</span><h1>Make a video people can feel.</h1><p>Build a complete talking-character production from one clear brief.</p></div><span className="studio-status">● {characters.length} cast member{characters.length === 1 ? "" : "s"}</span></div>
          {error && <div className="error-banner">{error}</div>}
          {status && <div className="studio-progress"><span className="progress-pulse" />{status}</div>}
          <section className="studio-canvas">
            {stage === "brief" && <div className="studio-brief-view"><div className="canvas-kicker"><span>✦</span><span>Start with direction</span></div><h2>What should this video make people do?</h2><p>Describe the business, audience, offer, and feeling. HelloAI will turn it into dialogue, scenes, and a cast-led video.</p><div className="studio-brief-form"><label>Business or project name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HellowClean" /></label><label>Production brief<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A warm 30-second video for a local cleaning service. Show the team arriving, doing excellent work, and a happy customer..." /></label><button className="primary-button" type="button" onClick={buildScript} disabled={isWorking || !description.trim()}>{isWorking ? "Building..." : "Create the production plan →"}</button></div></div>}
            {stage === "script" && <div className="studio-editor-view"><div className="canvas-kicker"><span>02</span><span>Dialogue draft</span></div><h2>Give the story a voice.</h2><p>Every line becomes a speaking performance. Edit the draft before planning the shots.</p><textarea className="script-editor" value={script} onChange={(event) => setScript(event.target.value)} /><div className="studio-actions"><button className="secondary-button" type="button" onClick={() => setStage("brief")}>← Edit brief</button><button className="primary-button" type="button" onClick={buildStoryboard} disabled={isWorking || !script.trim()}>{isWorking ? "Planning..." : "Plan the storyboard →"}</button></div></div>}
            {stage === "storyboard" && <div className="studio-storyboard-view"><div className="canvas-kicker"><span>03</span><span>Storyboard</span></div><div className="storyboard-heading"><div><h2>Shape every moment.</h2><p>{scenes.length} scenes are ready for your cast.</p></div><button className="primary-button" type="button" onClick={renderVideo} disabled={isWorking || characters.length === 0}>{isWorking ? "Rendering..." : "Render talking video →"}</button></div><div className="studio-scene-list">{scenes.map((scene) => <article className="studio-scene" key={scene.scene}><img src={scene.imageUrl} alt={`Storyboard scene ${scene.scene}`} /><div><span>SCENE 0{scene.scene}</span><h3>{scene.imagePrompt}</h3><small>Visual direction generated from your dialogue</small></div></article>)}</div>{characters.length === 0 && <div className="studio-warning">Add at least one avatar and voice in <a href="/characters">Characters</a> before rendering.</div>}</div>}
            {stage === "render" && <div className="studio-render-view"><div className="render-orbit">✦</div><h2>Your cast is coming to life.</h2><p>{status || "HeyGen is animating the characters and syncing their voices."}</p><div className="render-bar"><span /></div><small>This can take a few minutes. You can leave this tab open.</small></div>}
            {stage === "ready" && videoUrl && <div className="studio-ready-view"><div className="canvas-kicker"><span>05</span><span>Final deliverable</span></div><h2>Ready for the world.</h2><video controls src={videoUrl} /><a className="primary-button" href={videoUrl} download="helloai-talking-video.mp4">Download final MP4 ↓</a></div>}
          </section>
        </section>
      </div>
    </main>
  );
}
