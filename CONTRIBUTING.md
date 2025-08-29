# Contributing

This project uses Preview Deployments and CI to ensure features are safe before publishing to production.

## Workflow

1. Create a feature branch
   - `git checkout -b feat/<short-name>`
2. Develop
   - `npm test`
   - `npm run build` (or `vercel pull --yes --environment=preview && vercel build`)
3. Push and open a PR
   - Vercel creates a Preview deployment automatically.
   - GitHub Actions runs unit tests and a full Next.js build.
4. Verify
   - Click the Preview URL and check the changed pages.
   - Make sure CI checks are green.
5. Merge to `main`
   - Production deploy triggers off `main`.

## Pull Request

- Use conventional PR titles (e.g., `feat(leads): KPI tiles for branches`).
- Fill in the PR template (Preview URL, migrations, env vars).
- If adding SQL migrations, place them under `drizzle/` and add rollout notes.
- If adding env vars, update `.env.example` and note Preview/Prod values.

## Local hooks (optional but recommended)

- Enable repo hooks: `git config core.hookspath .githooks`
- The `pre-push` hook runs tests and a production build before pushing.

## Vercel CLI (optional)

- `vercel login` → `vercel link`
- `vercel pull --yes --environment=preview`
- `vercel build` → `vercel deploy --prebuilt`

This reproduces Vercel’s build locally and publishes the exact build artifact as a Preview deployment.

