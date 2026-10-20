import { encryptGoogleSession, getGoogleSessionCookieName } from "../../../../../lib/google-session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

  if (!code) {
    return Response.json({ error: "Missing OAuth code" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: "Google OAuth environment variables are not configured." },
      { status: 500 }
    );
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return Response.json(
        { error: tokenData?.error_description || "Google token exchange failed" },
        { status: 400 }
      );
    }

    const response = Response.redirect(new URL("/seo?google=connected", request.url));
    response.headers.append("Set-Cookie", `${getGoogleSessionCookieName()}=${encryptGoogleSession({ accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000 })}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Google callback failed" },
      { status: 500 }
    );
  }
}
