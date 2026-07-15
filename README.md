# Fairway Club PWA

A premium multi-tenant golf-club experience for players, club staff, and platform operators.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The seeded demo works without environment variables. Player login uses `TWT-4821` / `4821`; the club and platform dashboards are linked from the app.

## Deploy on Railway

The repository includes a multi-stage production `Dockerfile`, `railway.json`, and an uncached health endpoint at `/api/health`.

1. In Railway, create a project and select **Deploy from GitHub repo**.
2. Choose `PollyJr/golf-app`. Railway will detect the root `Dockerfile` and configuration automatically.
3. Add the environment variables listed below when using Supabase. They are optional for the seeded demo.
4. Deploy, then open **Settings → Networking** and generate a public domain.
5. Confirm `/api/health` returns `{ "status": "ok" }` on the generated domain.

Railway supplies `PORT` automatically. The container listens on `0.0.0.0`, runs as an unprivileged user, and uses Next.js standalone output.

## Production backend and variables

1. Create a Supabase project and apply `supabase/migrations/202607140001_initial.sql`.
2. Copy `.env.example` to `.env.local` and fill in the project credentials plus a long random session secret.
3. Configure the site and redirect URLs for magic-link authentication in Supabase.
4. Add the same values to the Railway service before deploying:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
```

Generate `SESSION_SECRET` as a long random value and never expose the service-role key to the browser. When Supabase is not configured, the application intentionally runs in seeded demo mode.

The migration contains the tenant-aware schema, role model, immutable score snapshots, leaderboard view, indexes, and row-level security policies. The UI automatically remains in seeded demo mode when Supabase is not configured.
