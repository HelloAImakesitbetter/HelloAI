# HelloAI

This project is a Next.js app for website strategy, SEO planning, publishing setup, and provider connection workflows.

## Features in this app

- General-purpose Home assistant with opt-in saved conversations and links to app workflows
- Website builder workflow
- SEO engine and audit flow
- Scheduled tasks manager
- Plugin and provider status page
- Real environment-driven connection checks for external systems

## Required setup before live provider connections

Copy [.env.example](.env.example) to a local environment file and add your real values.

```bash
cp .env.example .env.local
```

Then set the real values for:

- OpenAI API key
- Supabase URL and keys
- Google OAuth client ID and secret
- GOOGLE_SESSION_SECRET for encrypted Google sessions
- SEMRUSH_API_KEY for live backlink reporting
- Meta app credentials for WhatsApp
- Any provider-specific URLs or project IDs you want to enable

## Provider connection checklist

### Google

1. Create a Google Cloud project
2. Enable OAuth and required APIs
3. Create an OAuth client ID
4. Add redirect URI:
   - http://localhost:3000/api/auth/google/callback
5. Add credentials to your environment

### WhatsApp / Meta

1. Create or connect a Meta Business account
2. Create a WhatsApp app
3. Add the phone number ID and access token
4. Set the webhook verification token in your environment

### Publishing providers

- WordPress: set WORDPRESS_BASE_URL
- Shopify: set SHOPIFY_STORE_DOMAIN
- Webflow: set WEBFLOW_SITE_ID
- GitHub / Vercel: set GITHUB_REPOSITORY and VERCEL_PROJECT_NAME
- Custom CMS: set CUSTOM_CMS_ENDPOINT

## Run locally

```bash
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Production verification

```bash
npm run build
```

Search Console performance is loaded from the connected Google account and reports observed clicks, impressions, CTR, and average position for the selected property. This is measured Search Console data, not a guaranteed live rank. Backlink reporting is enabled only when SEMRUSH_API_KEY is configured; the app shows an unavailable state instead of inventing backlink data.

Signed-in users can persist their website and SEO workspace in the existing Supabase `projects` table. Ensure that table allows authenticated users to upsert their own rows for `kind` values `website` and `seo`.

This project includes route generation and app plumbing for working connection flows, but real third-party integrations still require active provider accounts and credentials.
