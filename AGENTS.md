<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repository

Fairway is a multi-tenant golf club app: Next.js 16 (App Router), React 19,
TypeScript, Tailwind 4, PostgreSQL. `README.md` describes the product and the
architecture; this file is the short list of rules that keep the code coherent.

## Layers

- `src/lib/**` is shared by server and browser and must stay free of server
  imports. The golf rules in `src/lib/golf` are pure functions with unit tests;
  change the tests together with the rules.
- `src/server/services/**` owns all SQL and business rules. Every function takes
  the club id from the caller's session; never accept a club id from request
  input. Mutations that others should see call `publish()` inside their
  transaction and write an `audit()` entry.
- API routes (`src/app/api/**/route.ts`) are thin and are always built with
  `route()` from `src/server/http/route.ts`, which does authentication, the
  role check, CSRF verification and input validation. Input schemas live in
  `src/lib/validation.ts`.
- Pages are server components that call services directly. Client components
  talk to the API through `api` from `src/lib/api-client.ts` and refresh with
  `router.refresh()` or `useLiveResource`.

## Conventions

- **Text**: every user-visible string goes through `t()`. Dutch
  (`src/lib/i18n/messages/nl`) is the source of truth; add the English text in
  the same change (the compiler rejects a missing key). Error codes thrown by
  services need a message under `common.errors`.
- **Styling**: use the semantic tokens from `src/app/globals.css`
  (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `text-under`, …) and
  the type utilities `font-display`, `font-label`, `font-score`. No hard-coded
  colours and no `dark:` variants: themes and club colours come from the
  tokens. Chart colours are the validated `--chart-*` tokens.
- **Scores** are shown with `ScoreMark` / `ToPar`; circles are under par,
  squares over par. Never encode a result by colour alone.
- **Dates** are formatted with the helpers in `src/lib/format.ts` and the
  club's time zone, so server and browser render the same text.
- **Dialogs** use `Dialog`; never `window.confirm/prompt/alert`. One-time
  secrets (PINs, passwords) are shown once and never stored in plain text.
- **Motion** uses the `animate-*` utilities and motion tokens in
  `globals.css`, the hooks in `src/hooks/use-motion.ts` (`useFlip`,
  `useChangeCount`, `useCountUp`) and `src/components/motion`. Links say which
  way a page transition goes with `transitionTypes` (`NAV_FORWARD`,
  `NAV_BACK`, `NAV_TAB`). Anything animated from JavaScript checks
  `prefersReducedMotion()`; CSS animations are handled globally.
- **Database**: add a new numbered file to `db/migrations`; never edit one that
  has shipped. Enum parameters need an explicit cast in SQL
  (`$1::round_status`) when the same parameter is used twice.

## Before you finish

```bash
npm run lint && npm run typecheck && npm test   # tests need PostgreSQL, see README
npm run build
npm run e2e                                     # with the dev server and demo seed running
```
