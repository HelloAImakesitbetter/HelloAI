"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type WebsitePage = {
  slug: string;
  label: string;
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
  seoTitle: string;
  seoDescription: string;
};
type WebsiteDraft = { pages: WebsitePage[] };
type Photo = { name: string; url: string; x: number; y: number };

export default function WebsiteBuilderPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<WebsiteDraft | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("home");
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [draggingPhoto, setDraggingPhoto] = useState<{ pageSlug: string; name: string } | null>(null);

  const selectedPage = draft?.pages.find((page) => page.slug === selectedSlug) || draft?.pages[0];
  const seoTitleLength = selectedPage?.seoTitle?.length || 0;
  const seoDescriptionLength = selectedPage?.seoDescription?.length || 0;
  const seoChecks = [seoTitleLength >= 30 && seoTitleLength <= 60, seoDescriptionLength >= 120 && seoDescriptionLength <= 160, Boolean(selectedPage?.title), Boolean(selectedPage?.primaryCta)].filter(Boolean).length;

  useEffect(() => {
    const saved = window.localStorage.getItem("helloai-website-draft");
    if (!saved) return;
    try {
      const data = JSON.parse(saved) as { businessName?: string; description?: string; draft?: WebsiteDraft; photos?: Record<string, Photo[]> };
      setBusinessName(data.businessName || "");
      setDescription(data.description || "");
      setDraft(data.draft || null);
      setPhotos(Object.fromEntries(Object.entries(data.photos || {}).map(([slug, pagePhotos]) => [slug, (pagePhotos as Photo[]).map((photo, index) => ({ ...photo, x: photo.x ?? 5 + (index % 3) * 30, y: photo.y ?? 12 + Math.floor(index / 3) * 28 }))])));
    } catch { /* Ignore stale local drafts. */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("helloai-website-draft", JSON.stringify({ businessName, description, draft, photos }));
  }, [businessName, description, draft, photos]);

  const buildWebsite = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/website", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, description }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to build website");
      setDraft(data.draft);
      setSelectedSlug("home");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to build website");
    } finally {
      setIsLoading(false);
    }
  };

  const updateSelectedPage = (field: keyof WebsitePage, value: string) => {
    if (!draft || !selectedPage) return;
    setDraft({ ...draft, pages: draft.pages.map((page) => page.slug === selectedPage.slug ? { ...page, [field]: value } : page) });
  };

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedPage || !event.target.files) return;
    const files = Array.from(event.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((current) => ({ ...current, [selectedPage.slug]: [...(current[selectedPage.slug] || []), { name: file.name, url: String(reader.result), x: 5 + ((current[selectedPage.slug] || []).length % 3) * 30, y: 12 + Math.floor((current[selectedPage.slug] || []).length / 3) * 28 }] }));
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  return (
    <main className="website-builder-shell">
      <header className="website-builder-header"><a href="/" className="back-link">← HelloAI workspace</a><span className="eyebrow">WEBSITE BUILDER</span></header>
      <div className="website-builder-grid website-builder-grid-wide">
        <section className="website-brief-panel">
          <span className="eyebrow">BUILD A COMPLETE SITE</span><h1>Shape every page before it goes live.</h1>
          <p>Generate a site map, review pages one by one, edit the copy, and add your own photos to each page.</p>
          <form onSubmit={buildWebsite} className="website-form"><label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HelloCleaners" /></label><label>Website brief<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you offer, who is it for, and what should visitors do next?" required /></label>{error && <div className="error-banner">{error}</div>}<button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Building site map..." : "Build website draft  →"}</button></form>
          {draft && <div className="page-review-panel"><span className="eyebrow">PAGES TO REVIEW</span>{draft.pages.map((page) => <button key={page.slug} className={page.slug === selectedPage?.slug ? "page-tab selected" : "page-tab"} type="button" onClick={() => setSelectedSlug(page.slug)}><span>{page.label}</span><small>Review and edit</small><b>→</b></button>)}</div>}
        </section>
        <section className="website-preview-frame">
          {selectedPage ? <div className="website-preview">
            <div className="preview-nav"><strong>{businessName || selectedPage.title}</strong><span>{draft?.pages.map((page) => <button key={page.slug} className={page.slug === selectedPage.slug ? "preview-nav-active" : ""} type="button" onClick={() => setSelectedSlug(page.slug)}>{page.label}</button>)}</span></div>
            <div className="preview-hero"><span className="preview-badge">{selectedPage.label.toUpperCase()}</span><h2>{selectedPage.title}</h2><p>{selectedPage.tagline}</p><div className="preview-actions"><button>{selectedPage.primaryCta}</button><button className="outline-button">{selectedPage.secondaryCta}</button></div></div>
            <div className="preview-intro"><p>{selectedPage.intro}</p></div>
            {(photos[selectedPage.slug] || []).length > 0 && <div className="preview-photo-canvas" onPointerMove={(event) => { if (!draggingPhoto || draggingPhoto.pageSlug !== selectedPage.slug) return; const bounds = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(78, ((event.clientX - bounds.left) / bounds.width) * 100 - 10)); const y = Math.max(0, Math.min(78, ((event.clientY - bounds.top) / bounds.height) * 100 - 10)); setPhotos((current) => ({ ...current, [selectedPage.slug]: current[selectedPage.slug].map((photo) => photo.name === draggingPhoto.name ? { ...photo, x, y } : photo) })); }} onPointerUp={() => setDraggingPhoto(null)} onPointerLeave={() => setDraggingPhoto(null)}><span className="canvas-label">DRAG PHOTOS INTO PLACE</span>{photos[selectedPage.slug].map((photo) => <img key={photo.name + photo.url} src={photo.url} alt={photo.name} draggable={false} style={{ left: `${photo.x ?? 5}%`, top: `${photo.y ?? 12}%` }} onPointerDown={(event) => { event.preventDefault(); setDraggingPhoto({ pageSlug: selectedPage.slug, name: photo.name }); }} />)}</div>}
            <div className="preview-benefits">{selectedPage.benefits.map((benefit, index) => <article key={benefit + index}><span>0{index + 1}</span><h3>{benefit}</h3><p>Designed around what matters to your customers.</p></article>)}</div>
            <div className="preview-steps"><span className="eyebrow">HOW IT WORKS</span><div>{selectedPage.steps.map((step, index) => <p key={step + index}><b>0{index + 1}</b>{step}</p>)}</div></div><div className="preview-closing"><h3>{selectedPage.closing}</h3><button>{selectedPage.primaryCta}</button></div>
          </div> : <div className="website-empty"><div>✦</div><h2>Your website preview will appear here.</h2><p>Start with the business brief on the left.</p></div>}
        </section>
        {selectedPage && <aside className="website-editor-panel"><span className="eyebrow">EDIT {selectedPage.label.toUpperCase()}</span><h2>Page controls</h2><label>Headline<input value={selectedPage.title} onChange={(event) => updateSelectedPage("title", event.target.value)} /></label><label>Tagline<textarea value={selectedPage.tagline} onChange={(event) => updateSelectedPage("tagline", event.target.value)} /></label><label>Intro<textarea value={selectedPage.intro} onChange={(event) => updateSelectedPage("intro", event.target.value)} /></label><label>Primary button<input value={selectedPage.primaryCta} onChange={(event) => updateSelectedPage("primaryCta", event.target.value)} /></label><label>Secondary button<input value={selectedPage.secondaryCta} onChange={(event) => updateSelectedPage("secondaryCta", event.target.value)} /></label><div className="seo-panel"><div className="seo-panel-heading"><span className="eyebrow">SEO READINESS</span><strong>{seoChecks}/4</strong></div><label>SEO title <small>{seoTitleLength}/60 characters</small><input value={selectedPage.seoTitle || ""} onChange={(event) => updateSelectedPage("seoTitle", event.target.value)} /></label><label>SEO description <small>{seoDescriptionLength}/160 characters</small><textarea value={selectedPage.seoDescription || ""} onChange={(event) => updateSelectedPage("seoDescription", event.target.value)} /></label><p>Use a clear service, location, and customer outcome. These fields become your search preview.</p></div><div className="photo-upload"><span className="eyebrow">PAGE PHOTOS</span><p>Add photos to this page preview.</p><label className="upload-button">+ Add photos<input type="file" accept="image/*" multiple onChange={addPhotos} /></label>{(photos[selectedPage.slug] || []).map((photo) => <div className="uploaded-photo" key={photo.name + photo.url}><img src={photo.url} alt={photo.name} /><span>{photo.name}</span></div>)}</div></aside>}
      </div>
    </main>
  );
}
