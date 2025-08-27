# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router (routes + API). Global styles in `app/globals.css`.
- `src/`: App code. `src/db/` (Drizzle schema), `src/lib/` (utilities).
- `components/`: Reusable UI (PascalCase, e.g., `components/AppHeader.tsx`).
- `drizzle/`: Generated SQL migrations and policies.
- `public/`: Static assets. `tests/`: `unit/` (Vitest).

## Build, Test, and Development Commands

- `npm run dev`: Start dev server on `:3000`.
- `npm run build`: Production build. `npm start`: Serve built app.
- `npm test`: Run Vitest unit tests (headless). `npm run test:ui`: interactive Vitest.
- `npm run lint` / `npm run format`: ESLint / Prettier.
- Migrations: apply the SQL files in `drizzle/` via Supabase SQL editor.
- Minimal scripts: `npm run dev`, `build`, `start`, `lint`, `format`, `test`, `db:*`.

## Coding Style & Naming Conventions

- TypeScript strict mode; path alias `@/* → src/*` (also `~/* → repo root`).
- Prettier: single quotes, semicolons, trailing commas; 2‑space indent.
- ESLint: extends `next/core-web-vitals`; Next image/link rules disabled where practical.
- Components/files: PascalCase in `components/`; route folders in `app/` are kebab‑case.

## Testing Guidelines

- Unit: Vitest (jsdom). Place tests under `tests/unit/*.test.ts`. Prefer focused tests near business logic (`src/lib/*`, helpers).
- Coverage: no hard gate configured; add meaningful tests for schema and critical flows.

## Commit & Pull Request Guidelines

- Commits: Conventional Commits (e.g., `feat(settings): ...`, `fix(build): ...`, `chore: ...`).
- PRs: clear description, linked issues, screenshots for UI changes, migration notes if touching `drizzle/`, and any env var changes. Ensure `npm run lint` and unit tests pass.

## Security & Configuration Tips

- Never commit `.env`; update `.env.example` when adding variables (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
- Keep secrets server‑only (avoid exposing non‑public values via `NEXT_PUBLIC_*`).
- Respect multi‑tenant RLS and tenant‑prefixed storage keys defined in migrations.
