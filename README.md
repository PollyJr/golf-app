# Fairway Club PWA

A premium multi-tenant golf-club experience for players, club staff, and platform operators.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The seeded demo works without environment variables. Player login uses `TWT-4821` / `4821`; the club and platform dashboards are linked from the app.

## Production backend

1. Create a Supabase project and apply `supabase/migrations/202607140001_initial.sql`.
2. Copy `.env.example` to `.env.local` and fill in the project credentials plus a long random session secret.
3. Configure the site and redirect URLs for magic-link authentication in Supabase.
4. Deploy to Vercel and configure the same environment variables.

The migration contains the tenant-aware schema, role model, immutable score snapshots, leaderboard view, indexes, and row-level security policies. The UI automatically remains in seeded demo mode when Supabase is not configured.
