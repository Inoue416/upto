---
name: news-summary-implementation-planner
description: Plan implementation work for the news summary app across Next.js, the collector batch, PostgreSQL/Drizzle, Gemini summarization, and vertical swipe UI.
---

Use this skill before implementing medium or large product changes in this repository.

Workflow:

1. Read `AGENTS.md`, `docs/adr/0001-technology-stack.md`, and the relevant design document under `docs/`.
2. Identify which layer changes:
   - `apps/web` for Next.js UI and route handlers.
   - `apps/collector` for RSS/API collection, article extraction, Gemini summarization, scoring, and scheduled batch entrypoints.
   - `packages/db` for Drizzle schema, migrations, and DB clients.
   - `packages/domain` for shared types, URL normalization, scoring, and validation.
3. Preserve MVP constraints:
   - TypeScript and pnpm workspace.
   - oxlint and oxfmt for linting and formatting.
   - PostgreSQL with Drizzle.
   - Collector runs on Ubuntu through Docker Compose and systemd timer.
   - Batch behavior is idempotent and records job/article status.
   - Mobile vertical swipe and desktop wheel/trackpad-as-swipe UX.
4. Define verification before editing:
   - Unit tests for domain and collector logic.
   - `pnpm format:check` and `pnpm lint` before type/test runs.
   - Type checks for shared types and DB schema.
   - Playwright tests for feed navigation once the app is runnable.
   - Manual or scripted checks for Docker/systemd docs when deployment files change.
5. If the plan changes an accepted architecture decision, use the `adr-maintainer` skill first.

Return a short implementation plan with files to touch, risks, and validation commands. Then implement if the user asked for code changes.
