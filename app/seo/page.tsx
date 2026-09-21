"use client";

import { FormEvent, useEffect, useState } from "react";

type SeoPage = { page: string; keyword: string; title: string; description: string; intent: string };
type SeoReport = {
  summary: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  priorityWins: string[];
  monthlyPlan: { month: string; focus: string; result: string }[];
  pages: SeoPage[];
  localActions: string[];
  contentIdeas: { title: string; keyword: string; format: string }[];
  checklist: { task: string; priority: "High" | "Medium" | "Low"; reason: string }[];
};
type AuditIssue = { key: string; label: string; status: "pass" | "warning" | "fail"; detail: string; fix: string };
type AuditedPage = { url: string; title: string; description: string; wordCount: number; score: number; issues: AuditIssue[] };
type WebsiteAudit = { url: string; checkedAt: string; score: number; title: string; description: string; wordCount: number; pagesFound: number; pagesChecked: number; pages: AuditedPage[]; issues: AuditIssue[] };
type GrowthIntelligence = {
  summary: string;
  missingServicePages: { title: string; keyword: string; reason: string; priority: string }[];
  locationPages: { title: string; keyword: string; localAngle: string; priority: string }[];
  landingPages: { title: string; audience: string; offer: string; priority: string }[];
  contentClusters: { topic: string; supportingArticles: string[] }[];
  conversionFixes: { issue: string; fix: string; impact: string }[];
  competitorGaps: { opportunity: string; whyItMatters: string; nextAction: string }[];
  forecast: { currentMonthlyTraffic: number; estimatedMonthlyTraffic: number; assumptions: string[] };
  autopilot: string[];
};
type PublishingProvider = "wordpress" | "shopify" | "webflow" | "github-vercel" | "custom";
const publishingProviders: { id: PublishingProvider; name: string; description: string }[] = [
  { id: "wordpress", name: "WordPress", description: "REST API publishing" },
  { id: "shopify", name: "Shopify", description: "Admin API publishing" },
  { id: "webflow", name: "Webflow", description: "Site API publishing" },
  { id: "github-vercel", name: "GitHub / Vercel", description: "Repository deployment" },
  { id: "custom", name: "Custom CMS", description: "Your CMS API" },
];

const issueImpact: Record<string, { label: string; score: number }> = {
  title: { label: "High revenue impact", score: 95 },
  description: { label: "High revenue impact", score: 90 },
  h1: { label: "High revenue impact", score: 86 },
  content: { label: "Growth impact", score: 74 },
  technical: { label: "Growth impact", score: 68 },
  crawl: { label: "Foundational impact", score: 62 },
  images: { label: "Trust impact", score: 48 },
};
const autoFixableIssues = new Set(["title", "description", "h1", "content", "technical"]);

export default function SeoPage() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [report, setReport] = useState<SeoReport | null>(null);
  const [audit, setAudit] = useState<WebsiteAudit | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [connectedSite, setConnectedSite] = useState("");
  const [autoApplyFixes, setAutoApplyFixes] = useState(false);
  const [provider, setProvider] = useState<PublishingProvider>("wordpress");
  const [providerFields, setProviderFields] = useState<Record<string, string>>({});
  const [connectedProviders, setConnectedProviders] = useState<Record<string, string>>({});
  const [isConnectingProvider, setIsConnectingProvider] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [intelligence, setIntelligence] = useState<GrowthIntelligence | null>(null);
  const [isGrowing, setIsGrowing] = useState(false);

  useEffect(() => {
    const savedSite = window.localStorage.getItem("helloai-seo-connected-site");
    if (savedSite) {
      setConnectedSite(savedSite);
      setWebsiteUrl(savedSite);
    }
    setAutoApplyFixes(window.localStorage.getItem("helloai-seo-auto-fix") === "true");
  }, []);

  const generateReport = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, description, location, websiteUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate SEO plan");
      setReport(data.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate SEO plan");
    } finally {
      setIsLoading(false);
    }
  };

  const auditWebsite = async () => {
    setIsAuditing(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to audit website");
      setAudit(data.audit);
      setConnectedSite(data.audit.url);
      window.localStorage.setItem("helloai-seo-connected-site", data.audit.url);
      setStatusMessage(`Connected to ${data.audit.url}. SEO checks are now linked to this site.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to audit website");
    } finally {
      setIsAuditing(false);
    }
  };

  const growBusiness = async () => {
    setIsGrowing(true);
    setError("");
    try {
      const response = await fetch("/api/seo/intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, description, location, websiteUrl, competitorUrl, audit }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to build growth plan");
      setIntelligence(data.intelligence);
      setStatusMessage("Growth map ready: pages, content, conversion fixes, and an execution plan are prepared.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to build growth plan");
    } finally {
      setIsGrowing(false);
    }
  };

  const queueFix = (issueKey: string) => {
    setReviewQueue((current) => current.includes(issueKey) ? current.filter((key) => key !== issueKey) : [...current, issueKey]);
    setStatusMessage("");
    setError("");
  };

  const connectProvider = async () => {
    setIsConnectingProvider(true);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/seo/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...providerFields }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Provider connection failed");
      setConnectedProviders((current) => ({ ...current, [provider]: data.label }));
      setStatusMessage(data.detail);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Provider connection failed");
    } finally {
      setIsConnectingProvider(false);
    }
  };

  const setProviderField = (key: string, value: string) => setProviderFields((current) => ({ ...current, [key]: value }));

  const applyAutoFixes = (issueKey?: string) => {
    if (!audit && !report) return;
    try {
      const existingDraft = window.localStorage.getItem("helloai-website-draft");
      const parsedDraft = existingDraft ? JSON.parse(existingDraft) : { businessName: "", description: "", draft: null, photos: {} };

      if (!parsedDraft?.draft?.pages?.length && !report?.pages?.length) {
        setError("Build a HelloAI website draft before applying automatic SEO fixes.");
        setStatusMessage("");
        return;
      }

      const relevantIssues = typeof issueKey === "string"
        ? (audit?.issues || []).filter((issue) => issue.key === issueKey && issue.status !== "pass")
        : (audit?.issues || []).filter((issue) => (autoApplyFixes || reviewQueue.includes(issue.key)) && issue.status !== "pass");

      if (!relevantIssues.length) {
        setStatusMessage("No SEO issues need fixing right now.");
        setError("");
        return;
      }

      const primaryKeyword = report?.primaryKeyword || (description ? description.split(" ").slice(0, 3).join(" ") : "local service");
      const businessLabel = businessName || "Business";
      const localSuffix = location ? ` in ${location}` : "";
      const seoBaseIntro = report?.summary || `${businessLabel} helps local customers find the right solution faster with clear service information, trusted expertise, and a simple path to action.`;

      const fallbackPages = report?.pages?.map((page) => ({
        slug: page.page.toLowerCase().replace(/\s+/g, "-"),
        label: page.page,
        title: page.title || `${businessLabel} ${page.page}${localSuffix}`,
        tagline: page.keyword ? `${page.keyword}${localSuffix}` : `Trusted ${primaryKeyword}${localSuffix}`,
        intro: page.description || `${businessLabel} helps local customers find practical ${page.keyword || primaryKeyword} solutions with clear guidance and a fast path to action.`,
        primaryCta: "Book a consultation",
        secondaryCta: "View services",
        benefits: ["Clear service information", "Local trust and proof", "Fast next steps"],
        steps: ["Understand your needs", "Review the right plan", "Take action confidently"],
        closing: `Ready to get started with ${businessLabel}?`,
        seoTitle: page.title || `${businessLabel} ${page.page}${localSuffix}`,
        seoDescription: page.description || `${businessLabel} provides helpful local ${page.keyword || primaryKeyword} guidance and a simple way to get started with confidence.`,
      })) || [];

      const draftPages = Array.isArray(parsedDraft?.draft?.pages) && parsedDraft.draft.pages.length ? parsedDraft.draft.pages : fallbackPages;
      const fixedPages = draftPages.map((page: any, index: number) => {
        const promptPage = report?.pages?.[index] || report?.pages?.[0] || null;
        const serviceKeyword = (promptPage?.keyword || page.keyword || primaryKeyword || "service").trim();
        const pageTitle = `${businessLabel} ${page.label || promptPage?.page || "Services"}${localSuffix}`;
        const pageIntro = `${businessLabel} helps local customers find practical ${serviceKeyword} solutions with clear guidance, strong service details, and an easy next step to contact the team.`;
        const seoDescription = `${businessLabel} provides local ${serviceKeyword} support with transparent pricing, clear service details, and a simple way to get started when customers are ready.`;

        const issueHints = new Set(relevantIssues.map((item) => item.key));
        const titleFix = issueHints.has("title") ? pageTitle : (page.title || pageTitle);
        const descriptionFix = issueHints.has("description") ? seoDescription : (page.seoDescription || seoDescription);
        const headingFix = issueHints.has("h1") ? pageTitle : (page.title || pageTitle);
        const contentFix = issueHints.has("content") ? pageIntro : (page.intro || pageIntro);
        const technicalFix = issueHints.has("technical") ? seoDescription : (page.seoDescription || seoDescription);

        const fixedTitle = titleFix.length > 60 ? titleFix.slice(0, 57).trimEnd() + "..." : titleFix;
        const fixedSeoTitle = (page.seoTitle || titleFix || pageTitle).length > 60 ? ((page.seoTitle || titleFix || pageTitle).slice(0, 57).trimEnd() + "...") : (page.seoTitle || titleFix || pageTitle);
        const fixedSeoDescription = (descriptionFix || technicalFix || page.seoDescription || seoDescription).length > 160 ? ((descriptionFix || technicalFix || page.seoDescription || seoDescription).slice(0, 157).trimEnd() + "...") : (descriptionFix || technicalFix || page.seoDescription || seoDescription);
        const fixedIntro = (contentFix || page.intro || pageIntro).length > 220 ? (contentFix || page.intro || pageIntro).slice(0, 217).trimEnd() + "..." : (contentFix || page.intro || pageIntro);
        const nextTagline = (page.tagline || `${serviceKeyword}${localSuffix}` || `Trusted ${serviceKeyword}${localSuffix}`).trim();
        const nextBenefits = Array.isArray(page.benefits) && page.benefits.length ? page.benefits : ["Clear service information", "Strong local trust", "Fast contact options"];
        const nextSteps = Array.isArray(page.steps) && page.steps.length ? page.steps : ["Understand your needs", "Review the best option", "Move forward with confidence"];
        const nextClosing = (page.closing || `Ready to start with ${businessLabel}?`).trim();
        const nextPrimaryCta = (page.primaryCta || "Book a consultation").trim();
        const nextSecondaryCta = (page.secondaryCta || "View services").trim();

        return {
          ...page,
          title: fixedTitle,
          tagline: nextTagline,
          intro: fixedIntro,
          primaryCta: nextPrimaryCta,
          secondaryCta: nextSecondaryCta,
          benefits: nextBenefits.map((value: string, valueIndex: number) => value && value.trim() ? value : ["Clear service information", "Strong local trust", "Fast contact options"][valueIndex]),
          steps: nextSteps.map((value: string, valueIndex: number) => value && value.trim() ? value : ["Understand your needs", "Review the best option", "Move forward with confidence"][valueIndex]),
          closing: nextClosing,
          seoTitle: fixedSeoTitle,
          seoDescription: fixedSeoDescription,
          h1: headingFix,
        };
      });

      const nextDraft = { pages: fixedPages };
      const savedWebsite = {
        ...parsedDraft,
        businessName: parsedDraft.businessName || businessName,
        description: parsedDraft.description || description,
        draft: nextDraft,
        photos: parsedDraft.photos || {},
      };

      window.localStorage.setItem("helloai-website-draft", JSON.stringify(savedWebsite));
      const issueSummary = relevantIssues.map((issue) => issue.label).slice(0, 3).join(", ") || "SEO metadata and page structure";
      window.localStorage.setItem("helloai-website-autofix", JSON.stringify({ updatedAt: new Date().toISOString(), summary: issueSummary }));
      setStatusMessage(`Auto-fixed website issues: ${issueSummary}. The website builder has been updated.`);
      setReviewQueue((current) => current.filter((key) => !relevantIssues.some((issue) => issue.key === key)));
      setError("");
    } catch (requestError) {
      setError("Auto-fix could not be applied. Please try again.");
    }
  };

  useEffect(() => {
    if (autoApplyFixes && audit) applyAutoFixes();
  }, [audit, autoApplyFixes]);

  const opportunityScore = report
    ? Math.min(99, Math.max(42, 48 + (report.priorityWins.length || 1) * 8 + (report.pages.length || 4) * 3 + report.checklist.filter((item) => item.priority === "High").length * 6))
    : 0;

  return (
    <main className="seo-shell">
      <header className="seo-header">
        <a href="/" className="back-link">← HelloAI workspace</a>
        <div className="seo-brand">
          <span className="eyebrow">GROWTH STUDIO</span>
          <strong>Search visibility</strong>
        </div>
        <a className="secondary-button" href="/website">Open website builder</a>
      </header>

      <div className="seo-layout">
        <aside className="seo-brief">
          <span className="eyebrow">AI SEO STRATEGY</span>
          <h1>Turn your website into a discovery engine.</h1>
          <p>Get a revenue-focused SEO plan, then audit the live site and turn gaps into concrete actions.</p>

          <form onSubmit={generateReport}>
            <label>
              Business name
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. HellowCleaners" />
            </label>
            <label>
              What do you offer?
              <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe your service, ideal customer, and what makes you different..." />
            <label>
              Competitor website <span className="optional-label">optional</span>
              <input value={competitorUrl} onChange={(event) => setCompetitorUrl(event.target.value)} placeholder="https://competitor.com" />
            </label>
            </label>
            <label>
              Primary location
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Austin, Texas" />
            </label>
            <label>
              Website to connect
              <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourbusiness.com" />
            </label>

            {error && <div className="error-banner">{error}</div>}
            {statusMessage && <div className="success-banner">{statusMessage}</div>}

            <div className="seo-form-actions">
              <button className="primary-button" type="submit" disabled={isLoading || !description.trim()}>
                {isLoading ? "Finding opportunities..." : "Build SEO plan →"}
              </button>
              <button className="secondary-button" type="button" onClick={auditWebsite} disabled={isAuditing || !websiteUrl.trim()}>
                {isAuditing ? "Connecting and auditing..." : connectedSite ? "Re-check connected site" : "Connect and audit site"}
              </button>
              <button className="secondary-button grow-business-button" type="button" onClick={growBusiness} disabled={isGrowing || (!description.trim() && !websiteUrl.trim())}>
                {isGrowing ? "Finding growth opportunities..." : "Grow my business"}
              </button>
              {audit && (
                <button className="secondary-button" type="button" onClick={() => applyAutoFixes()} disabled={!reviewQueue.length}>
                  Apply {reviewQueue.length || "selected"} reviewed fixes
                </button>
              )}
            </div>
          </form>
          <section className={`seo-connect-card ${connectedSite ? "connected" : ""}`}>
            <span className="eyebrow">SITE CONNECTION</span>
            <strong>{connectedSite ? "SEO is connected" : "Connect your live website"}</strong>
            <p>{connectedSite ? connectedSite : "Add your public URL to scan every discoverable page, including pages outside your main navigation."}</p>
            {connectedSite && <button type="button" className="seo-disconnect-button" onClick={() => { window.localStorage.removeItem("helloai-seo-connected-site"); setConnectedSite(""); setAudit(null); setWebsiteUrl(""); setStatusMessage("Website disconnected from this SEO workspace."); }}>Disconnect site</button>}
          </section>
          {connectedSite && <section className="seo-automation-card">
            <span className="eyebrow">AUTOMATION MODE</span>
            <label className="seo-toggle-row">
              <span><strong>{autoApplyFixes ? "Automatic safe fixes" : "Review fixes first"}</strong><small>{autoApplyFixes ? "Metadata, headings, and content fixes apply to the HelloAI website draft after each audit." : "Choose each fix before it changes the HelloAI website draft."}</small></span>
              <input type="checkbox" checked={autoApplyFixes} onChange={(event) => { const enabled = event.target.checked; setAutoApplyFixes(enabled); window.localStorage.setItem("helloai-seo-auto-fix", String(enabled)); }} />
            </label>
          </section>}
          <section className="seo-publishing-card">
            <span className="eyebrow">PUBLISHING CONNECTIONS</span>
            <strong>Connect your site platform</strong>
            <p>Verify a publishing account so approved SEO patches can be sent to the right system. Tokens are sent to the server only and are not saved in this browser.</p>
            <div className="seo-provider-list">
              {publishingProviders.map((item) => <button key={item.id} type="button" className={`seo-provider-option ${provider === item.id ? "active" : ""}`} onClick={() => setProvider(item.id)}><span><strong>{item.name}</strong><small>{item.description}</small></span><b>{connectedProviders[item.id] ? "Connected" : "Connect"}</b></button>)}
            </div>
            <select value={provider} onChange={(event) => setProvider(event.target.value as PublishingProvider)}>
              <option value="wordpress">WordPress REST API</option>
              <option value="shopify">Shopify Admin API</option>
              <option value="webflow">Webflow API</option>
              <option value="github-vercel">GitHub / Vercel deployment</option>
              <option value="custom">Custom CMS API</option>
            </select>
            {provider === "wordpress" && <><input placeholder="WordPress site URL" value={providerFields.baseUrl || ""} onChange={(event) => setProviderField("baseUrl", event.target.value)} /><input type="password" placeholder="Application access token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}
            {provider === "shopify" && <><input placeholder="store.myshopify.com" value={providerFields.shopDomain || ""} onChange={(event) => setProviderField("shopDomain", event.target.value)} /><input type="password" placeholder="Admin API access token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}
            {provider === "webflow" && <><input placeholder="Webflow site ID" value={providerFields.siteId || ""} onChange={(event) => setProviderField("siteId", event.target.value)} /><input type="password" placeholder="Webflow API token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}
            {provider === "github-vercel" && <><input placeholder="owner/repository" value={providerFields.repository || ""} onChange={(event) => setProviderField("repository", event.target.value)} /><input placeholder="Vercel project name" value={providerFields.vercelProject || ""} onChange={(event) => setProviderField("vercelProject", event.target.value)} /><input type="password" placeholder="GitHub or deployment token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}
            {provider === "custom" && <><input placeholder="Custom CMS verification endpoint" value={providerFields.endpoint || ""} onChange={(event) => setProviderField("endpoint", event.target.value)} /><input type="password" placeholder="CMS API token" value={providerFields.token || ""} onChange={(event) => setProviderField("token", event.target.value)} /></>}
            <button className="secondary-button" type="button" onClick={connectProvider} disabled={isConnectingProvider}>{isConnectingProvider ? "Verifying connection..." : connectedProviders[provider] ? `Connected: ${connectedProviders[provider]}` : "Verify and connect"}</button>
          </section>
        </aside>

        <section className="seo-results">
          {!report && !audit && (
            <div className="seo-empty">
              <div>⌕</div>
              <h2>Search strategy in one place</h2>
              <p>Build a local SEO plan for your business and review the live site health before publishing new pages.</p>
            </div>
          )}

          {report && (
            <>
              <section className="seo-report-hero">
                <div className="seo-hero-copy">
                  <span className="eyebrow">COMPETITIVE EDGE</span>
                  <h2>{report.primaryKeyword}</h2>
                  <p>{report.summary}</p>
                </div>
                <div className="seo-opportunity">
                  <span>Opportunity</span>
                  <strong>{opportunityScore}</strong>
                  <small>/100</small>
                </div>
              </section>

              <div className="seo-summary-grid">
                <article className="seo-summary-card">
                  <span className="eyebrow">PRIMARY FOCUS</span>
                  <strong>{report.primaryKeyword}</strong>
                  <small>Best keyword to anchor your site around.</small>
                </article>
                <article className="seo-summary-card">
                  <span className="eyebrow">SUPPORTING TERMS</span>
                  <strong>{report.secondaryKeywords.slice(0, 3).join(" • ") || "Local intent keywords"}</strong>
                  <small>Secondary targets for topical depth.</small>
                </article>
                <article className="seo-summary-card">
                  <span className="eyebrow">LOCAL ACTIONS</span>
                  <strong>{report.localActions.length}</strong>
                  <small>Quick wins you can complete this week.</small>
                </article>
              </div>

              <section className="seo-section">
                <div className="section-heading">
                  <span className="eyebrow">PRIORITY WINS</span>
                </div>
                <ul className="seo-priority-list">
                  {report.priorityWins.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="seo-section">
                <div className="section-heading">
                  <span className="eyebrow">90-DAY PLAN</span>
                </div>
                <div className="seo-plan-grid">
                  {report.monthlyPlan.map((plan) => (
                    <article key={plan.month} className="seo-plan-item">
                      <span>{plan.month}</span>
                      <strong>{plan.focus}</strong>
                      <p>{plan.result}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="seo-section">
                <div className="section-heading">
                  <span className="eyebrow">PAGE STRATEGY</span>
                </div>
                <div className="seo-page-table">
                  {report.pages.map((page) => (
                    <article key={page.page} className="seo-page-row">
                      <div className="seo-page-header">
                        <span>{page.page}</span>
                        <small>{page.keyword}</small>
                      </div>
                      <div className="seo-page-summary">
                        <strong>{page.title}</strong>
                        <p>{page.description}</p>
                      </div>
                      <div className="seo-page-intent">
                        <span>Intent</span>
                        <b>{page.intent}</b>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="seo-section">
                <div className="section-heading">
                  <span className="eyebrow">CONTENT IDEAS</span>
                </div>
                <div className="content-idea-grid">
                  {report.contentIdeas.map((idea) => (
                    <article key={`${idea.title}-${idea.keyword}`} className="content-idea-card">
                      <span>{idea.format}</span>
                      <h3>{idea.title}</h3>
                      <p>{idea.keyword}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="seo-section">
                <div className="section-heading">
                  <span className="eyebrow">ACTION CHECKLIST</span>
                </div>
                <div className="seo-checklist">
                  {report.checklist.map((item) => (
                    <article key={item.task} className={`seo-checklist-item ${item.priority.toLowerCase()}`}>
                      <span className="priority-tag">{item.priority}</span>
                      <div>
                        <strong>{item.task}</strong>
                        <p>{item.reason}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}

          {audit && (
            <section className="seo-audit">
              <div className="seo-audit-score">
                <span className="eyebrow">LIVE SITE AUDIT</span>
                <strong>{audit.score}</strong>
                <small>/100</small>
                <p>{audit.url}</p>
                <small>{audit.pagesChecked} of {audit.pagesFound} discovered pages checked</small>
                <small className="seo-review-count">{reviewQueue.length} fix{reviewQueue.length === 1 ? "" : "es"} selected for review</small>
              </div>
              <div className="seo-audit-issues">
                <div className="seo-audit-pages">
                  <span className="eyebrow">DISCOVERED PAGES</span>
                  {audit.pages.map((page) => (
                    <div key={page.url}><span className={`audit-status audit-${page.score >= 80 ? "pass" : page.score >= 55 ? "warning" : "fail"}`}>{page.score}</span><a href={page.url} target="_blank" rel="noreferrer">{new URL(page.url).pathname || "/"}</a><small>{page.title || "Untitled page"}</small></div>
                  ))}
                </div>
                {audit.issues.map((issue) => (
                  <article key={issue.key}>
                    <span className={`audit-status audit-${issue.status}`}>
                      {issue.status === "pass" ? "✓" : issue.status === "warning" ? "!" : "×"}
                    </span>
                    <div>
                      <strong>{issue.label} {issue.status !== "pass" && <em className={`impact-${issueImpact[issue.key]?.score >= 85 ? "high" : "medium"}`}>{issueImpact[issue.key]?.label || "Growth impact"}</em>}</strong>
                      <small>{issue.detail}</small>
                      <p>{issue.fix}</p>
                      {issue.status !== "pass" && autoFixableIssues.has(issue.key) && (
                        <button type="button" className={`seo-fix-button ${reviewQueue.includes(issue.key) ? "selected" : ""}`} onClick={() => queueFix(issue.key)}>
                          {reviewQueue.includes(issue.key) ? "Selected for review" : "Review fix"}
                        </button>
                      )}
                      {issue.status !== "pass" && !autoFixableIssues.has(issue.key) && <small className="manual-review-note">Manual review required in your website host</small>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {intelligence && (
            <section className="seo-intelligence">
              <div className="seo-intelligence-hero"><span className="eyebrow">AI SEO OPERATING SYSTEM</span><h2>{intelligence.summary}</h2><p>These are opportunities and estimates, not guaranteed rankings. Approve the actions you want HelloAI to execute.</p></div>
              <div className="seo-intelligence-stats"><article><strong>{intelligence.missingServicePages.length}</strong><span>Service pages missing</span></article><article><strong>{intelligence.locationPages.length}</strong><span>Local pages to consider</span></article><article><strong>{intelligence.landingPages.length}</strong><span>Lead pages to build</span></article><article><strong>{intelligence.contentClusters.length}</strong><span>Content clusters</span></article></div>
              <section className="seo-intelligence-section"><div className="section-heading"><span className="eyebrow">FIX EVERYTHING QUEUE</span></div><div className="seo-opportunity-grid">{[...intelligence.missingServicePages.map((item) => ({ title: item.title, meta: item.keyword, detail: item.reason })), ...intelligence.locationPages.map((item) => ({ title: item.title, meta: item.keyword, detail: item.localAngle })), ...intelligence.landingPages.map((item) => ({ title: item.title, meta: item.audience, detail: item.offer }))].slice(0, 12).map((item) => <article key={item.title}><span>Opportunity</span><h3>{item.title}</h3><strong>{item.meta}</strong><p>{item.detail}</p><button type="button" className="seo-fix-button">Add to build queue</button></article>)}</div></section>
              <section className="seo-intelligence-section"><div className="section-heading"><span className="eyebrow">CONTENT CLUSTERS</span></div><div className="seo-cluster-list">{intelligence.contentClusters.map((cluster) => <article key={cluster.topic}><strong>{cluster.topic}</strong><p>{cluster.supportingArticles.join(" · ")}</p></article>)}</div></section>
              <section className="seo-intelligence-section"><div className="section-heading"><span className="eyebrow">CONVERSION FIXES</span></div><div className="seo-checklist">{intelligence.conversionFixes.map((item) => <article key={item.issue}><span className="priority-tag">{item.impact}</span><div><strong>{item.issue}</strong><p>{item.fix}</p></div></article>)}</div></section>
              <section className="seo-forecast"><div><span className="eyebrow">FORECAST, NOT A PROMISE</span><h3>{intelligence.forecast.currentMonthlyTraffic} → {intelligence.forecast.estimatedMonthlyTraffic} estimated monthly visits</h3><p>{intelligence.forecast.assumptions.join(" ")}</p></div><div><span className="eyebrow">AUTOPILOT RHYTHM</span>{intelligence.autopilot.map((step) => <p key={step}>✓ {step}</p>)}</div></section>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
