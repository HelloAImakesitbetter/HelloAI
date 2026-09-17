# HelloAI API

The public API is versioned under `/api/v1`.

## Authentication

Send the private HelloAI key as a bearer token:

```http
Authorization: Bearer YOUR_HELLOAI_API_KEY
```

Set `HELLOAI_API_KEY` in Vercel. Never expose it in browser code or commit it to GitHub.

## Health

```http
GET /api/v1/health
```

## Chat

```http
POST /api/v1/chat
Content-Type: application/json
Authorization: Bearer YOUR_HELLOAI_API_KEY

{
  "messages": [
    { "role": "user", "content": "Give me three campaign ideas." }
  ],
  "businessName": "Example Business",
  "description": "A local service business"
}
```

The current implementation uses an internal AI adapter. Customers only depend on the HelloAI API contract, so the model provider can be replaced later.
