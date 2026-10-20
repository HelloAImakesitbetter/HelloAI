import { cookies } from "next/headers";
import { decryptGoogleSession, getGoogleSessionCookieName, encryptGoogleSession } from "../../../../lib/google-session";

type SearchConsoleRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

async function googleJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Google API returned HTTP ${response.status}`);
  return body;
}

async function getAccessToken() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getGoogleSessionCookieName())?.value;
  const session = raw ? decryptGoogleSession(raw) : null;
  if (!session) throw new Error("Connect Google first from the SEO workspace.");
  if (session.expiresAt > Date.now() + 60_000) return { token: session.accessToken, session, cookieStore };
  if (!session.refreshToken) throw new Error("Google session expired. Connect Google again.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: session.refreshToken, grant_type: "refresh_token" }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body?.error_description || "Google session refresh failed. Connect Google again.");
  const refreshed = { ...session, accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
  return { token: refreshed.accessToken, session: refreshed, cookieStore };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get("siteUrl")?.trim();
    const days = Math.min(90, Math.max(7, Number(searchParams.get("days") || 28)));
    const { token, session, cookieStore } = await getAccessToken();
    const sites = await googleJson("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` } });
    const availableSites = (sites.siteEntry || []).filter((site: { permissionLevel?: string }) => site.permissionLevel !== "siteUnverifiedUser");
    const selectedSite = siteUrl || availableSites[0]?.siteUrl;
    if (!selectedSite) return Response.json({ connected: true, sites: [], rows: [] });
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - days);
    const report = await googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(selectedSite)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), dimensions: ["query", "page"], rowLimit: 250, dataState: "final" }) });
    const response = Response.json({ connected: true, siteUrl: selectedSite, sites: availableSites, days, rows: (report.rows || []) as SearchConsoleRow[] });
    if (session.expiresAt !== (decryptGoogleSession(cookieStore.get(getGoogleSessionCookieName())?.value || "")?.expiresAt || session.expiresAt)) response.headers.append("Set-Cookie", `${getGoogleSessionCookieName()}=${encryptGoogleSession(session)}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Search Console request failed" }, { status: 400 });
  }
}
