# HelloAI Agent Foundation

## Current-state audit

HelloAI is a Next.js 16.4.0 App Router application using React 19, TypeScript, Supabase JS, OpenAI Responses API, and Inngest. AI provider calls run in route handlers using a server-side `OPENAI_API_KEY`; the website generation, page refinement, chat, SEO strategy, SEO growth intelligence, and image-edit workflows are separate actions.

The application already has useful execution primitives:

- The Website Builder suggests a sitemap first, then generates selected pages one at a time with the full business brief and summaries of other planned/generated pages. Page drafts, page-specific requests, and navigation visibility preferences persist to the user's browser or Supabase `projects` table.
- Hiding a page removes it from the HelloAI preview navigation plan; it does not make the page private. WordPress pages are created as drafts, and WordPress navigation must be updated separately after publishing.
- The WordPress page workflow can create a selected page as a draft after an explicit confirmation. It does not publish the page publicly.
- Website auditing and competitor snapshots retrieve live public web pages.
- Supabase project rows use `auth.uid()` row-level policies.

## Gaps that block autonomous runs

- The agent planner and saved-run endpoints validate Supabase bearer sessions, but most existing AI and publishing routes still do not establish an authenticated owner.
- The repository now has migrations for `projects` and planned agent runs/tasks/dependencies. It still lacks tool-call evidence, persisted approval records, artifacts, and state-transition RPCs.
- The home workspace can submit a goal, save a validated plan, explicitly start/cancel a run, and display owner-scoped status and result history.
- The scheduled-task screen still stores tasks in `localStorage`. Its “Run now” action changes a displayed counter and notice; it does not enqueue or execute work.
- An Inngest worker is implemented for website generation, but it has not been configured or exercised against a live Inngest app. Automatic retries are disabled for this first slice; failed runs are persisted and require a new run.
- `.env.local` contains the public Supabase URL/key, `OPENAI_API_KEY`, and `CRON_SECRET`; `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY` are not configured. Do not expose or commit these server-side keys.
- Website-generation tasks now contain validated structured inputs. WordPress credentials remain transient form inputs, not a revocable server-side integration, so the background worker cannot access WordPress and only creates private HelloAI drafts.
- There are no test files or test script in the current repository. The configured checks are ESLint and Next.js build/type generation.
- External integrations are mixed maturity: WordPress draft creation is implemented; the shared connection UI includes providers whose actual write workflows are not implemented.

## First implementation sequence

The initial foundation now includes a server-side Supabase token verifier, an authenticated plan-creation API, owner-scoped run history, a home UI for creating/reviewing plans and starting/cancelling runs, and a Vercel-compatible Inngest integration. Migration `003_agent_execution.sql` adds typed tool inputs, attempt/result/evidence fields, tool-call audit rows, and owner-checked start/cancel transitions. The first worker is deliberately limited to one `website.generate` task per run; it validates the returned site map and stores the verified draft with evidence. Automatic worker retries are disabled until idempotent recovery tests are in place. Plans remain `planned` until the user starts them.

The worker fails closed until `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY` are configured as server-only environment variables. The service-role key must never be exposed in a `NEXT_PUBLIC_` variable. The user must apply migration `003_agent_execution.sql` after migrations 001 and 002. Apply `004_chat_conversations.sql` to enable explicitly saved, owner-scoped chat history. Chat messages are not persisted unless the customer selects Save conversation; saved chats can be reopened, explicitly updated, or deleted. Apply `005_delete_inactive_agent_runs.sql` to enable customer deletion of saved plans; active runs cannot be deleted until they stop. The production dependency audit is clean; the dev-only audit still reports high-severity issues in the `eslint-config-next` dependency tree, for which npm proposes a breaking downgrade that was not applied.

For local execution, create an Inngest account/app and run its local dev server alongside Next.js. Configure the app's Inngest event key and signing key in `.env.local`, add the Supabase service-role key privately, restart Next.js, and sync the Inngest app endpoint at `http://localhost:3000/api/inngest` in the Inngest Dev Server. For production, add those server-side keys in Vercel and register the deployed `/api/inngest` endpoint with Inngest.

### 1. Server identity and ownership

Create a server-only Supabase auth helper that validates bearer access tokens with `auth.getUser`. Establish how authenticated browser requests pass the access token. Add request-size limits, field validation, consistent error responses, and rate limits before exposing run-creation endpoints. Do not accept a user ID supplied in a request body as identity.

**Gate:** unauthenticated and invalid-token requests are rejected; a user cannot read or mutate another user's records.

### 2. Durable run state

Run/task tables and owner-scoped state transitions are now defined across migrations 002 and 003. Apply migration 003 to enable structured task inputs, evidence, and start/cancel operations. Add transition and cross-user tests; keep database state as the source of truth.

**Gate:** ownership and state-transition tests pass under separate user sessions.

### 3. Bounded planner and tool registry

Begin with the existing website/SEO capabilities. Require structured plans with success criteria, stable task IDs, and dependencies. Register only concrete tools with validated schemas, permissions, timeouts, and structured results. Keep consequential writes approval-gated; the existing WordPress workflow should remain draft-only until the user approves publishing in WordPress.

**Gate:** invalid plans and unauthorized tool calls are rejected, and each completed task has tool evidence.

### 4. Durable execution and verification

Expand beyond the first website-generation worker only after validating local and deployed Inngest delivery, duplicate event behavior, worker restart, cancellation, generated result recovery, and failure reporting. Add safe bounded retries with per-attempt accounting and reconciliation for uncertain outcomes before enabling paid or external-write tools. Define revocable ownership and retention for integration credentials before allowing a background worker to access them. Keep WordPress draft creation behind a separate explicit approval step.

**Gate:** a multi-step run survives browser closure and a worker restart without losing progress or duplicating side effects.

### 5. Evaluation and gradual rollout

Add focused tests for auth, ownership, planning schemas, tool permissions, task transitions, worker recovery, duplicate delivery, budget exhaustion, and verification failure. Establish task success, cost, latency, and unsupported-claim baselines before adding model routing, memory, specialist agents, voice, or broad autonomous permissions.

## Recommended first vertical slice

The first vertical slice is implemented in code: plan one website-generation task, start it through Inngest, persist the generated multi-page draft, and independently verify page count and the home-page slug. Next apply migration 003, configure Inngest and the server-only Supabase key, then exercise success, failure, cancellation, duplicate delivery, and worker restart. WordPress draft creation remains a separate foreground action until a secure approval and credential-storage design exists.
