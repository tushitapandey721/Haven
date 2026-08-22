# Sentinel AI

Sentinel is a calm reflective conversation space with an explicit safety engine, honest AI provider behavior, reflection summaries, and anonymized research analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sentinel-ai` — the React + Vite frontend with entrance, space, reflections, and research routes.
- `artifacts/api-server` — the Express API, PostgreSQL-backed Sentinel store, safety analysis, intervention policy, and optional OpenAI provider.
- `lib/api-spec/openapi.yaml` — API source of truth.
- `lib/api-client-react/src/generated` — generated React Query hooks.
- `lib/api-zod/src/generated` — generated request/response validators.
- `docs/architecture.md` — product and safety architecture.

## Architecture decisions

- The API owns safety analysis, intervention levels, and environment mode selection; the LLM only writes natural language.
- Missing or failed AI configuration produces an honest 503 rather than a fabricated response.
- The frontend keeps the conversation central and uses slow atmospheric transitions, including reduced-motion support.
- Research analytics are aggregate-only and do not expose private conversation text.
- The current preview uses one server-side local profile until authentication is added; no user ID is accepted from the browser.

## Product

Users enter through a quiet threshold, hold reflective conversations, inspect recurring topics and questions, approve environment objects explicitly, and view an anonymized research surface.

## User preferences

- Keep Sentinel calm, curious, grounded, and honest about being AI.
- Never diagnose, reinforce unsupported harmful claims as fact, or encourage emotional dependency.

## Gotchas

- Regenerate client and Zod outputs after changing `lib/api-spec/openapi.yaml`.
- The app build needs workflow-provided `PORT` and `BASE_PATH`, or explicit values in shell commands.
- The preview database schema includes the future RAG and audit tables, but RAG retrieval, semantic model classification, Redis/workers, and researcher authorization are not yet implemented.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
