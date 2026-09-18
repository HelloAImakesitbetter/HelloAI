"use client";

import { FormEvent, useState } from "react";

type WebsiteDraft = {
  title: string;
  tagline: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: string[];
  steps: string[];
  closing: string;
};

export default function WebsiteBuilderPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<WebsiteDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const buildWebsite = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, description }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to build website");
      setDraft(data.draft);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to build website");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="website-builder-shell">
      <header className="website-builder-header">
        <a href="/" className="back-link">← HelloAI workspace</a>
        <span className="eyebrow">WEBSITE BUILDER</span>
      </header>
      <div className="website-builder-grid">
        <section className="website-brief-panel">
          <span className="eyebrow">BUILD A SITE FROM A BRIEF</span>
          <h1>Turn your business into a clear online home.</h1>
          <p>Describe the offer, audience, and tone. HelloAI will create the first landing-page draft and preview it instantly.</p>
          <form onSubmit={buildWebsite} className="website-form">
            <label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HelloCleaners" /></label>
            <label>Website brief<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you offer, who is it for, and what should visitors do next?" required /></label>
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Building draft..." : "Build website draft  →"}</button>
          </form>
        </section>
        <section className="website-preview-frame">
          {draft ? <div className="website-preview">
            <div className="preview-nav"><strong>{businessName || draft.title}</strong><span>Services&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></div>
            <div className="preview-hero"><span className="preview-badge">A better way forward</span><h2>{draft.title}</h2><p>{draft.tagline}</p><div className="preview-actions"><button>{draft.primaryCta}</button><button className="outline-button">{draft.secondaryCta}</button></div></div>
            <div className="preview-intro"><p>{draft.intro}</p></div>
            <div className="preview-benefits">{draft.benefits.map((benefit, index) => <article key={benefit}><span>0{index + 1}</span><h3>{benefit}</h3><p>Designed around what matters to your customers.</p></article>)}</div>
            <div className="preview-steps"><span className="eyebrow">HOW IT WORKS</span><div>{draft.steps.map((step, index) => <p key={step}><b>0{index + 1}</b>{step}</p>)}</div></div>
            <div className="preview-closing"><h3>{draft.closing}</h3><button>{draft.primaryCta}</button></div>
          </div> : <div className="website-empty"><div>✦</div><h2>Your website preview will appear here.</h2><p>Start with the business brief on the left.</p></div>}
        </section>
      </div>
    </main>
  );
}
