# syntax=docker/dockerfile:1

# Fairway: Next.js standalone server plus the database scripts, on Node 22.

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- dependencies: cached until package*.json change ------------------------
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# `npm run build` ends with the postbuild step, which copies the static assets
# and public/ into .next/standalone. The second command adds the complete `pg`
# package for the database scripts and fails the build if they cannot load it.
RUN npm run build && node scripts/copy-db-deps.mjs

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# server.js, the traced node_modules, .next/static and public/.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Migrations and the migrate/bootstrap scripts, run before each deploy:
#   node db/migrate.mjs && node db/bootstrap.mjs
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs
# Railway provides PORT; 3000 is the default for local `docker run`.
EXPOSE 3000

CMD ["node", "server.js"]
