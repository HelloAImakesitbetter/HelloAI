"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

export default function ImageEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("helloai-edited.png");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!sourceUrl || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const quarterTurn = rotation % 180 !== 0;
      canvas.width = quarterTurn ? image.height : image.width;
      canvas.height = quarterTurn ? image.width : image.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      context.drawImage(image, -image.width / 2, -image.height / 2);
      context.restore();
    };
    image.src = sourceUrl;
  }, [sourceUrl, brightness, contrast, saturation, rotation]);

  const loadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, "") + "-edited.png");
    setSourceUrl(URL.createObjectURL(file));
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="image-editor-shell">
      <header className="website-builder-header"><a href="/" className="back-link">← HelloAI workspace</a><span className="eyebrow">PHOTO EDITOR</span></header>
      <div className="image-editor-layout">
        <section className="image-editor-controls">
          <span className="eyebrow">EDIT AN IMAGE</span><h1>Make the picture fit the idea.</h1><p>Upload a photo, tune the look, rotate it, and download the result. Basic edits run directly in your browser.</p>
          <label className="upload-button image-upload">+ Choose photo<input type="file" accept="image/*" onChange={loadImage} /></label>
          <div className="image-control-list">
            <label>Brightness <output>{brightness}%</output><input type="range" min="40" max="160" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label>
            <label>Contrast <output>{contrast}%</output><input type="range" min="40" max="160" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label>
            <label>Colour <output>{saturation}%</output><input type="range" min="0" max="180" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} /></label>
          </div>
          <div className="image-action-row"><button className="secondary-button" type="button" onClick={() => setRotation((value) => (value + 90) % 360)} disabled={!sourceUrl}>Rotate 90°</button><button className="primary-button" type="button" onClick={downloadImage} disabled={!sourceUrl}>Download image ↓</button></div>
        </section>
        <section className="image-canvas-frame"><div className="image-canvas-topline"><span>LIVE PREVIEW</span><span>{sourceUrl ? "Edits are ready" : "Choose a photo to begin"}</span></div>{sourceUrl ? <canvas ref={canvasRef} className="image-editor-canvas" /> : <div className="image-editor-empty"><span>✦</span><h2>Your photo will appear here.</h2><p>Nothing leaves your browser for basic edits.</p></div>}</section>
      </div>
    </main>
  );
}
