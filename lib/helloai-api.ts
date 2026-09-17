export function requireHelloAiApiKey(request: Request) {
  const configuredKey = process.env.HELLOAI_API_KEY;
  const providedKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredKey) {
    throw new Error("HELLOAI_API_KEY is not configured");
  }

  if (!providedKey || providedKey !== configuredKey) {
    return Response.json({ error: "Invalid HelloAI API key" }, { status: 401 });
  }

  return null;
}
