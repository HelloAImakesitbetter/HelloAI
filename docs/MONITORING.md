# HelloAI monitoring

The read-only monitor is available at `/api/monitor` and checks whether the required server-side configuration exists.

Vercel calls it every five minutes through `vercel.json`.

Add this Vercel environment variable to protect the endpoint:

```text
CRON_SECRET=generate-a-long-random-secret
```

The monitor currently checks:

- `OPENAI_API_KEY`
- `RUNWAYML_API_SECRET`
- `HELLOAI_API_KEY`

A `200` response means the configuration is present. A `503` response means the deployment is degraded. This monitor does not generate videos, spend provider credits, edit code, or deploy changes.

The next safe stage is connecting failures to an alert service, then allowing an agent to open a pull request with tests instead of changing production directly.
