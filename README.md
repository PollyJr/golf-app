# Fairway Club PWA

Premium multi-tenant golf software for players, club owners/staff, and platform administrators. The app supports 9- and 18-hole courses, score approval, day/week/month/year leaderboards, events, installable PWA behavior, and tenant-scoped PostgreSQL storage.

## Local development

```bash
npm ci
npm run db:migrate
npm run db:bootstrap
npm run dev
```

Copy `.env.example` to `.env.local` first. At minimum configure `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, and bootstrap credentials. Never commit either file or paste production credentials into issues or chat.

## Railway deployment

The repository includes a production `Dockerfile`, `railway.json`, database migrations, bootstrap automation, and `/api/health`. Link a Railway PostgreSQL service and configure:

```text
DATABASE_URL=<Railway internal PostgreSQL URL>
DATABASE_SSL=false
SESSION_SECRET=<long random value>
IP_HASH_SECRET=<different long random value>
BOOTSTRAP_ADMIN_EMAIL=<platform admin email>
BOOTSTRAP_ADMIN_PASSWORD=<minimum 12 characters>
BOOTSTRAP_CLUB_NAME=<club name>
BOOTSTRAP_OWNER_EMAIL=<club owner email>
BOOTSTRAP_OWNER_PASSWORD=<minimum 12 characters>
BOOTSTRAP_PLAYER_NAME=<optional first player>
BOOTSTRAP_PLAYER_CODE=<optional unique code>
BOOTSTRAP_PLAYER_PIN=<optional 4-12 digits>
```

Railway runs `npm run db:migrate` and `npm run db:bootstrap` before deployment. Bootstrap inserts missing accounts only; it does not overwrite existing passwords. After the first successful deploy, remove bootstrap password and PIN variables. Railway supplies `PORT`; the container listens on `0.0.0.0`.

## Security model

Sessions are opaque, random server-side records stored in PostgreSQL. Browser cookies are HttpOnly, Secure in production, and SameSite Strict. All modifying API calls require a session-bound CSRF token and a matching origin. Login attempts are rate-limited, accounts lock after repeated failures, passwords/PINs use scrypt, and security-relevant actions are audited.

Authorization is enforced in server pages and API handlers. Player, club owner/staff, and platform administrator roles have separate allowlists. Every club query uses the authenticated session's `club_id`; database composite foreign keys additionally reject cross-tenant relationships.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The health endpoint returns HTTP 503 when PostgreSQL is unavailable, allowing Railway to avoid routing traffic to an unhealthy release.
