"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PluginStatus = "available" | "planned" | "connected";
type Plugin = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: PluginStatus;
  href?: string;
};

const initialPlugins: Plugin[] = [
  { id: "wordpress", name: "WordPress", category: "Publishing", description: "Publish approved website and SEO updates through the WordPress REST API.", status: "available", href: "/website" },
  { id: "shopify", name: "Shopify", category: "Publishing", description: "Connect a Shopify store for commerce pages and metadata workflows.", status: "available", href: "/website" },
  { id: "webflow", name: "Webflow", category: "Publishing", description: "Send website changes to a connected Webflow project.", status: "available", href: "/website" },
  { id: "github-vercel", name: "GitHub / Vercel", category: "Publishing", description: "Prepare repository changes and deployment workflows for review.", status: "available", href: "/website" },
  { id: "google-search-console", name: "Google Search Console", category: "Analytics", description: "Bring real queries, clicks, impressions, and indexing signals into SEO decisions.", status: "available" },
  { id: "google-analytics", name: "Google Analytics", category: "Analytics", description: "Use traffic and conversion data to prioritize pages that can create revenue.", status: "available" },
  { id: "google-business-profile", name: "Google Business Profile", category: "Local growth", description: "Plan posts, service descriptions, Q&A content, and review responses.", status: "available" },
  { id: "custom", name: "Custom CMS", category: "Publishing", description: "Connect any CMS that accepts authenticated HelloAI patch requests.", status: "available", href: "/website" },
  { id: "whatsapp", name: "WhatsApp", category: "Lead generation", description: "Turn website visitors into conversations with a direct WhatsApp action.", status: "available" },
];

const providerFields: Record<string, { label: string; value: string; placeholder: string }> = {
  "google-search-console": { label: "Access token", value: "token", placeholder: "Paste your Google OAuth access token" },
  "google-analytics": { label: "Access token", value: "token", placeholder: "Paste your Google Analytics access token" },
  "google-business-profile": { label: "Access token", value: "token", placeholder: "Paste your Business Profile access token" },
  whatsapp: { label: "Access token", value: "token", placeholder: "Paste your WhatsApp / Meta access token" },
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState(initialPlugins);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [connectionState, setConnectionState] = useState<Record<string, string>>({});
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const categories = ["All", ...Array.from(new Set(plugins.map((plugin) => plugin.category)))];
  const visiblePlugins = useMemo(
    () =>
      plugins.filter(
        (plugin) =>
          (category === "All" || plugin.category === category) &&
          `${plugin.name} ${plugin.description}`.toLowerCase().includes(query.toLowerCase())
      ),
    [plugins, category, query]
  );

  const handleConnect = async (plugin: Plugin) => {
    const accessToken = tokenInputs[plugin.id]?.trim();
    if (!accessToken) {
      setError(`Add a valid access token for ${plugin.name} before connecting.`);
      setStatusMessage("");
      return;
    }

    setIsConnecting(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/plugins/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: plugin.id,
          token: accessToken,
          accountEmail: "",
          baseUrl: "",
          shopDomain: "",
          siteId: "",
          repository: "",
          vercelProject: "",
          endpoint: "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Connection failed for ${plugin.name}`);
      }

      setConnectionState((current) => ({ ...current, [plugin.id]: data.label }));
      setPlugins((current) =>
        current.map((item) => (item.id === plugin.id ? { ...item, status: "connected" } : item))
      );
      setStatusMessage(data.detail || `${plugin.name} connected successfully.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Connection failed for ${plugin.name}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="plugins-shell">
      <aside className="task-workspace-sidebar">
        <div className="task-brand"><span>H</span><strong>HelloAI</strong></div>
        <Link className="task-search" href="/">← Back to workspace</Link>
        <Link className="task-new-button" href="/website">＋ New task</Link>
        <nav className="task-nav">
          <Link href="/">⌂ <span>Home</span></Link>
          <Link href="/website">▤ <span>Website Builder</span></Link>
          <Link href="/seo">⌕ <span>SEO Engine</span></Link>
          <Link href="/scheduled">◷ <span>Scheduled</span></Link>
          <Link className="selected" href="/plugins">⌘ <span>Plugins</span></Link>
        </nav>
      </aside>

      <section className="plugins-main">
        <header className="plugins-header">
          <div>
            <span className="eyebrow">EXTENSIONS / CONNECTIONS</span>
            <h1>Plugins</h1>
            <p>Connect the systems HelloAI needs to build, measure, publish, and grow your business.</p>
          </div>
          <Link className="primary-button" href="/website">Connect a provider →</Link>
        </header>

        <div className="plugins-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plugins" />
          <div>
            {categories.map((item) => (
              <button key={item} className={category === item ? "active" : ""} type="button" onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </div>

        {statusMessage && <div className="seo-status-message">{statusMessage}</div>}
        {error && <div className="seo-error-message">{error}</div>}

        <section className="plugins-grid">
          {visiblePlugins.map((plugin) => {
            const isConnected = plugin.status === "connected" || Boolean(connectionState[plugin.id]);
            const fieldMeta = providerFields[plugin.id];

            return (
              <article className="plugin-card" key={plugin.id}>
                <div className="plugin-card-top">
                  <span className="plugin-mark">✦</span>
                  <span className={`plugin-status ${isConnected ? "connected" : plugin.status}`}>
                    {isConnected ? "Connected" : plugin.status === "planned" ? "Coming soon" : "Available"}
                  </span>
                </div>

                <span className="eyebrow">{plugin.category}</span>
                <h2>{plugin.name}</h2>
                <p>{plugin.description}</p>

                {fieldMeta && (
                  <div className="plugin-connect-field">
                    <label>{fieldMeta.label}</label>
                    <input
                      value={tokenInputs[plugin.id] ?? ""}
                      onChange={(event) => setTokenInputs((current) => ({ ...current, [plugin.id]: event.target.value }))}
                      placeholder={fieldMeta.placeholder}
                    />
                  </div>
                )}

                {plugin.href ? (
                  <Link className="secondary-button" href={plugin.href}>Set up plugin →</Link>
                ) : (
                  <button className="secondary-button" type="button" onClick={() => handleConnect(plugin)} disabled={isConnecting}>
                    {isConnecting ? "Connecting..." : isConnected ? "Reconnect" : "Connect provider →"}
                  </button>
                )}
              </article>
            );
          })}
        </section>

        {visiblePlugins.length === 0 && <div className="plugins-empty">No plugins match your search.</div>}
      </section>
    </main>
  );
}
