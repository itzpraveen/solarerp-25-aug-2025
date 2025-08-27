# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router (routes + API). Global styles in `app/globals.css`.
- `src/`: App code. `src/db/` (Drizzle schema), `src/lib/` (utilities).
- `components/`: Reusable UI (PascalCase, e.g., `components/AppHeader.tsx`).
- `drizzle/`: Generated SQL migrations and policies.
- `public/`: Static assets. `scripts/`: seeds/tools. `tests/`: `unit/` (Vitest), `e2e/` (Playwright).

## Build, Test, and Development Commands

- `npm run dev`: Start dev server on `:3000`.
- `npm run build`: Production build. `npm start`: Serve built app.
- `npm test`: Run Vitest unit tests (headless). `npm run test:ui`: interactive Vitest.
- `npm run test:e2e`: Run Playwright e2e (auto boots server, baseURL `http://localhost:3000`).
- `npm run lint` / `npm run format`: ESLint / Prettier.
- `npm run db:generate`: Generate Drizzle migrations to `drizzle/` from `src/db/schema.ts`.
- `npm run db:migrate`: Push migrations (requires `DATABASE_URL`). `npm run db:studio`: schema browser.
- `npm run seed` / `seed:full` / `unseed`: Demo data. `npm run doctor`: build/start/probe and save logs.

## Coding Style & Naming Conventions

- TypeScript strict mode; path alias `@/* → src/*` (also `~/* → repo root`).
- Prettier: single quotes, semicolons, trailing commas; 2‑space indent.
- ESLint: extends `next/core-web-vitals`; Next image/link rules disabled where practical.
- Components/files: PascalCase in `components/`; route folders in `app/` are kebab‑case.

## Testing Guidelines

- Unit: Vitest (jsdom). Place tests under `tests/unit/*.test.ts`. Prefer focused tests near business logic (`src/lib/*`, helpers).
- E2E: Playwright in `tests/e2e/*.spec.ts`. Keep tests idempotent and fast; CI runs Chromium/Firefox/WebKit. Use test IDs rather than brittle selectors when possible.
- Coverage: no hard gate configured; add meaningful tests for schema and critical flows.

## Commit & Pull Request Guidelines

- Commits: Conventional Commits (e.g., `feat(settings): ...`, `fix(build): ...`, `chore: ...`).
- PRs: clear description, linked issues, screenshots for UI changes, migration notes if touching `drizzle/`, and any env var changes. Ensure `npm run lint`, unit tests, and e2e pass (CI runs Playwright).

## Security & Configuration Tips

- Never commit `.env`; update `.env.example` when adding variables (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
- Keep secrets server‑only (avoid exposing non‑public values via `NEXT_PUBLIC_*`).
- Respect multi‑tenant RLS and tenant‑prefixed storage keys defined in migrations.
