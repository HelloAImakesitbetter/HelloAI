"use client";

import { FormEvent, useState } from "react";

type SeoPage = { page: string; keyword: string; title: string; description: string; intent: string };
type SeoReport = { summary: string; primaryKeyword: string; secondaryKeywords: string[]; pages: SeoPage[]; localActions: string[]; contentIdeas: { title: string; keyword: string; format: string }[]; checklist: { task: string; priority: "High" | "Medium" | "Low"; reason: string }[] };

export default function SeoPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [report, setReport] = useState<SeoReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, description, location, websiteUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate SEO plan");
      setReport(data.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate SEO plan");
    } finally {
      setIsLoading(false);
    }
  };

  return <main className="seo-shell"><header className="seo-header"><a href="/" className="back-link">← HelloAI workspace</a><div className="seo-brand"><span className="eyebrow">GROWTH STUDIO</span><strong>Search visibility</strong></div><a className="secondary-button" href="/website">Open website builder</a></header><div className="seo-layout"><aside className="seo-brief"><span className="eyebrow">AI SEO STRATEGY</span><h1>Turn your website into a discovery engine.</h1><p>Get a focused SEO plan for your business, not a pile of vague marketing advice.</p><form onSubmit={generateReport}><label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HellowCleaners" /></label><label>What do you offer?<textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe your service, ideal customer, and what makes you different..." /></label><label>Primary location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Austin, Texas" /></label><label>Existing website <span className="optional-label">optional</span><input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourbusiness.com" /></label>{error && <div className="error-banner">{error}</div>}<button className="primary-button" type="submit" disabled={isLoading || !description.trim()}>{isLoading ? "Finding opportunities..." : "Build SEO plan →"}</button></form></aside><section className="seo-results">{report ? <><div className="seo-report-hero"><span className="eyebrow">YOUR GROWTH MAP</span><h2>{report.summary}</h2><div className="keyword-pill"><span>PRIMARY TARGET</span><strong>{report.primaryKeyword}</strong></div></div><div className="seo-summary-grid"><article><span className="eyebrow">SUPPORTING TERMS</span><div className="keyword-list">{report.secondaryKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></article><article><span className="eyebrow">LOCAL SEARCH</span><ul>{report.localActions.map((action) => <li key={action}>{action}</li>)}</ul></article></div><section className="seo-section"><div className="seo-section-heading"><div><span className="eyebrow">PAGE-BY-PAGE</span><h2>Search-ready page plan</h2></div><span className="seo-count">{report.pages.length} pages</span></div><div className="seo-page-table">{report.pages.map((page) => <article key={page.page}><div className="seo-page-name"><strong>{page.page}</strong><small>{page.intent}</small></div><div><span className="target-keyword">{page.keyword}</span><h3>{page.title}</h3><p>{page.description}</p></div></article>)}</div></section><section className="seo-section"><div className="seo-section-heading"><div><span className="eyebrow">CONTENT ENGINE</span><h2>What to publish next</h2></div></div><div className="content-idea-grid">{report.contentIdeas.map((idea) => <article key={idea.title}><span>{idea.format}</span><h3>{idea.title}</h3><small>{idea.keyword}</small></article>)}</div></section><section className="seo-section"><div className="seo-section-heading"><div><span className="eyebrow">ACTION PLAN</span><h2>Prioritized checklist</h2></div></div><div className="seo-checklist">{report.checklist.map((item) => <article key={item.task}><span className={`priority-${item.priority.toLowerCase()}`}>{item.priority}</span><div><strong>{item.task}</strong><p>{item.reason}</p></div><button type="button" aria-label={`Mark ${item.task} complete`}>○</button></article>)}</div></section></> : <div className="seo-empty"><div>⌕</div><h2>Your growth map will appear here.</h2><p>Start with the business details on the left. HelloAI will connect your website, local search, and content into one clear plan.</p></div>}</section></div></main>;
}
