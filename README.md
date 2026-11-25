# Fairway

The club app for golf and short golf. Members keep a live scorecard with their
whole flight, follow the rankings and their own statistics, and sign up for
club events. The club reviews rounds, manages members, courses, events and
news, and can put a live scoreboard on a screen in the clubhouse.

Fairway is a multi-tenant web app (an installable PWA): one deployment serves
any number of clubs, each strictly separated from the others. An Android app
(`android/`) wraps the same web app for phones.

## What is in it

**For players** (`/app`)

- Sign in with an e-mail address (or player code or username) and a PIN; new
  members register themselves with their e-mail address and the club's join
  code (`/join/CODE`), optionally subject to approval. Members whose account
  the club created add their e-mail address when they first sign in.
- Every player has a personal QR code (`/p/TOKEN`). Scan a club mate's code
  to put them straight into a new round or the round you are playing; every
  round in its lobby or in play has its own code (`/r/TOKEN`) that a club
  mate scans to join. The scanner works in the browser and in the Android
  app; a link can also be pasted.
- Start a round on any course, over 9 or 18 holes, as stroke play, Stableford
  or match play. Invite up to three club mates and add guests.
- A live scorecard that everyone in the flight can fill in at the same time.
  Scores sync in real time, are queued while offline, and can be followed by
  anyone through a revocable share link.
- Results with the full card in scorecard notation, personal statistics, a
  club index (an unofficial, handicap-like number), and achievements.
- Rankings per day, week, month, year and all time; course records and the
  hole-in-one club.
- Events with registration, waiting list, calendar export and an event
  leaderboard; club news, course rules and course information.
- In-app notifications, Dutch and English, light and dark theme.

**For the club** (`/admin`)

- Dashboard, member management (create accounts with one-time PINs, approve
  registrations, reset PINs, deactivate), CSV exports.
- Review of submitted rounds (approve or reject, also in bulk), or automatic
  approval for clubs that prefer it.
- Courses with a hole-by-hole editor, events, news and announcements.
- Club settings: branding colours, contact details, join code, registration
  policy, the clubhouse board link. Staff accounts and an audit trail.

**For the platform** (`/platform`): create clubs with their first owner,
suspend and reactivate clubs.

**Public screens**: the clubhouse board (`/board/TOKEN`), a read-only
television view with live flights, rankings and the calendar; and the live
view of a shared round (`/live/TOKEN`).

## Architecture

| | |
|---|---|
| Framework | Next.js 16 (App Router, standalone output), React 19, TypeScript |
| Styling | Tailwind CSS 4 with semantic design tokens (`src/app/globals.css`) |
| Database | PostgreSQL, accessed with `pg` and hand-written SQL |
| Validation | zod schemas shared by browser and server (`src/lib/validation.ts`) |
| Tests | Vitest: unit tests and integration tests against a real PostgreSQL |

```
android/            the Android app (WebView shell, Kotlin)
db/                 migrations (plain SQL), migrate / bootstrap / demo-seed scripts
public/             service worker, icons, the Android APK and assetlinks.json
scripts/            build helpers
src/app/            routes: pages and the REST API under /api
src/components/     UI primitives (ui/), golf components, feature components
src/lib/            code shared by server and browser: golf rules, i18n, formatting
src/server/         server only: database, sessions, realtime, services
tests/              unit and integration tests
```

**Layers.** Pages and API routes are thin. They call *services*
(`src/server/services`), which own the SQL and the business rules and always
take the club id from the session. The golf rules themselves (scoring,
Stableford, match play, ranking, club index, achievements, statistics) are pure
functions in `src/lib/golf`, shared with the browser for optimistic updates.

**Realtime.** A service publishes a change with `pg_notify` inside its
transaction, so listeners only hear about committed changes. Each app instance
holds one `LISTEN` connection (`src/server/realtime/hub.ts`) and fans events out
to open Server-Sent Events streams. A stream only says *that* something
changed; the browser then refetches the resource with a conditional GET
(`src/hooks/use-live-resource.ts`), and falls back to polling when a stream
cannot be kept open. This works unchanged with several replicas.

**Security.**

- Sessions are random, opaque tokens; only their hash is stored. Cookies are
  `HttpOnly`, `Secure` in production and `SameSite=Lax`.
- Every mutation must come from the same origin and carry a CSRF token bound to
  the session. `src/server/http/route.ts` wraps each API route with
  authentication, role check, CSRF verification, input validation and uniform
  errors.
- Passwords and PINs are hashed with scrypt. Sign-in is rate limited per
  account and per client address, accounts lock temporarily after repeated
  failures, and responses do not reveal whether an account exists.
- A Content-Security-Policy with a per-request nonce is issued by
  `src/proxy.ts`; other security headers are set in `next.config.ts`.
- Tenancy is enforced twice: every query filters on the session's club, and
  composite foreign keys in the schema reject cross-club references.
- Security-relevant actions are written to an audit log, without secrets and
  with hashed client addresses.

**Internationalisation.** Dutch is the source language, English the second.
Messages live in typed dictionaries per area (`src/lib/i18n/messages`); the
compiler rejects a missing translation. Text that clubs write themselves
(course names, events, news) is stored per language in JSON columns.

**Migrations.** `db/migrations` holds numbered SQL files. `db/migrate.mjs`
applies the ones that have not run yet, each in its own transaction, under an
advisory lock. Files `001`–`005` are the original 1.x schema; `006` evolves it
in place, so existing data is kept.

## Local development

Requirements: Node.js 22 and PostgreSQL 15 or newer (the `pgcrypto` and
`citext` extensions are used).

```bash
createdb fairway_dev
cp .env.example .env.local         # adjust DATABASE_URL, set a SESSION_SECRET of 32+ characters
npm ci

# Schema, then the first accounts (bootstrap reads the BOOTSTRAP_* variables):
export DATABASE_URL=postgres://localhost:5432/fairway_dev   # the same value as in .env.local
BOOTSTRAP_ADMIN_EMAIL=platform@fairway.test BOOTSTRAP_ADMIN_PASSWORD=fairway-platform-1 \
BOOTSTRAP_OWNER_EMAIL=owner@fairway.test    BOOTSTRAP_OWNER_PASSWORD=fairway-owner-123 \
npm run db:prepare

npm run db:seed                    # optional: a lively demo club
npm run dev                        # http://localhost:3000
```

The database scripts read `DATABASE_URL` from the environment, not from
`.env.local`.

`npm run db:seed` fills the club *Shortgolf Twente* with members, four months
of rounds, live flights, events and news. Demo players sign in with the codes
`FW-DEMO01` (Sanne de Vries) to `FW-DEMO17` and PIN `1234`. Run it again with
`-- --force` to rebuild the demo data. It refuses to run with
`NODE_ENV=production` unless `--allow-production` is passed.

| Command | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build; also copies static assets into `.next/standalone` |
| `npm start` | runs the standalone production server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | unit and integration tests |
| `npm run e2e` | browser smoke test of the main journeys against a running, seeded app (`BASE_URL`, default `http://localhost:3000`) |
| `npm run db:migrate` / `db:bootstrap` / `db:prepare` / `db:seed` | database scripts |

The integration tests need a database they may wipe. They use
`postgres://fairway:fairway@127.0.0.1:5432/fairway_test` unless
`TEST_DATABASE_URL` says otherwise, and recreate its `public` schema on every
run.

## Android app

`android/` holds a small native Android app (Kotlin, no framework) that shows
the deployed web app in a WebView and adds what a browser tab cannot:

- QR-code links (`/p/…`, `/r/…`, `/join/…`, `/live/…`) open straight in the
  app (Android App Links, verified through `public/.well-known/assetlinks.json`);
- the QR scanner gets the camera through Android's permission dialog;
- the live link of a round is shared through the Android share sheet
  (`window.FairwayNative`, see `src/lib/native.ts`);
- the session survives restarts; CSV and calendar downloads go to Downloads;
- other websites, mail and phone links open in their own apps.

The web app recognises the app by `FairwayAndroid/<version>` in the user agent.

**Build the debug APK** (JDK 17+ and the Android SDK with platform 37):

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
cp app/build/outputs/apk/debug/app-debug.apk ../public/downloads/fairway-debug.apk
```

The web app serves that copy at `/downloads/fairway-debug.apk`; the sign-in
and profile pages link to it. The app opens the URL in `fairwayBaseUrl`
(`android/gradle.properties`); pass `-PfairwayBaseUrl=https://…` to build
for another deployment, and add that host's fingerprint to its
`assetlinks.json`.

The APK is signed with `android/keystore/debug.keystore` (password
`android`), which is in the repository on purpose: every build has the same
signature, so a new APK installs over the previous one and the App Links
fingerprint stays valid. It is a debug key: anyone can sign with it, so it
must never sign a release that goes to the Play Store. On the phone, allow
installing from your browser or file manager when Android asks.

## Deploying to Railway

The repository contains a `Dockerfile` and `railway.json`. Railway builds the
image, runs `npm run db:prepare` (migrate, then bootstrap) as the pre-deploy
command, and only routes traffic once `/api/health` answers 200.

1. Create a project with a **PostgreSQL** service and a service for this
   repository.
2. Set the variables of the app service:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (the private URL) |
   | `DATABASE_SSL` | `false` on Railway's private network; `true` for a public TLS endpoint |
   | `SESSION_SECRET` | at least 32 random characters, e.g. `openssl rand -base64 48` |
   | `IP_HASH_SECRET` | optional second secret; defaults to `SESSION_SECRET` |

3. For the **first deploy**, also set the accounts to create:

   | Variable | |
   |---|---|
   | `BOOTSTRAP_CLUB_NAME` | name of the first club (default `Shortgolf Twente`) |
   | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | platform administrator |
   | `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD` | owner of the club |
   | `BOOTSTRAP_PLAYER_NAME`, `BOOTSTRAP_PLAYER_CODE`, `BOOTSTRAP_PLAYER_PIN` | optional first player |

   Passwords need at least 12 characters, the PIN 4 to 12 digits. Bootstrap
   never overwrites an existing account, so it is safe on every deploy; still,
   remove the passwords and PIN from the variables once you have signed in. A
   new club gets a first nine-hole course so it can start playing right away.

4. Generate a public domain for the service. Railway provides `PORT`; the
   server listens on `0.0.0.0`.

**Lost access.** Set `BOOTSTRAP_RESET_CREDENTIALS=true` together with the
`BOOTSTRAP_*` e-mail and password (or player code and PIN) for one deploy: the
configured accounts get the configured credentials and their lock is cleared.
Remove the variable again afterwards.

## Operations

- **Health.** `GET /api/health` returns 200 with `{"status":"ok"}` when the
  database answers, and 503 otherwise. It exposes no connection details.
- **Backups.** All state is in PostgreSQL. On Railway that is the volume of
  the Postgres service; use Railway's volume backups or `pg_dump` against
  the public URL.
- **Adding a migration.** Add `db/migrations/009_what_it_does.sql` (the next
  number). Never edit a migration that has been deployed. It runs
  automatically before the next deploy; a failing migration rolls back and
  stops the deploy, leaving the running version untouched. Run `npm test` to
  apply every migration to an empty database.
- **Database scripts in the image.** The production image ships the
  standalone server plus `db/`. `scripts/copy-db-deps.mjs` adds the complete
  `pg` package during the image build, so the scripts do not depend on what
  Next.js happens to trace.
- **Service worker.** `public/sw.js` caches only hashed static files, the
  icons and the offline page. Bump `VERSION` in that file when its caching
  rules change.
- **Icons.** `node scripts/generate-icons.mjs` re-renders the PNG icons in
  `public/icons` (needs Playwright with Chromium on the developer machine).
- **Clubhouse board.** The link is shown in the club settings. Regenerating
  it there invalidates the old link.
