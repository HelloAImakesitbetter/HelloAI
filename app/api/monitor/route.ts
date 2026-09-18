const requiredEnvironmentVariables = [
  "OPENAI_API_KEY",
  "RUNWAYML_API_SECRET",
  "HEYGEN_API_KEY",
  "HELLOAI_API_KEY",
];

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = requiredEnvironmentVariables.map((name) => ({
    name,
    configured: Boolean(process.env[name]),
  }));
  const healthy = checks.every((check) => check.configured);

  return Response.json(
    {
      service: "HelloAI monitor",
      status: healthy ? "healthy" : "degraded",
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
