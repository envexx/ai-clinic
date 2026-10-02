# AI Clinic Front Desk

AI receptionist MVP for a wellness/aesthetics clinic: visitors can ask
administrative questions, book/reschedule/cancel appointments, and hand off to
staff. Staff use a dashboard to manage the same appointments and conversations.

This repository currently implements **M0 – Foundation** and **M1 – Clinic
configuration**. The product requirements live in
[`PRD_MVP_AI_Clinic_Front_Desk.md`](./PRD_MVP_AI_Clinic_Front_Desk.md) and the
staged delivery plan in [`PLAN.md`](./PLAN.md).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19, TypeScript strict |
| Database | Prisma Postgres (PostgreSQL), accessed with Prisma ORM + `@prisma/adapter-pg` |
| Knowledge retrieval | `pgvector` in Postgres (no external memory service) |
| AI | Google Gemini (free tier) via Vercel AI SDK + `@ai-sdk/google` (from M4) |
| Styling | Tailwind CSS v4 |
| Tests | Vitest (unit) + `scripts/smoke.mjs` (runtime) |

## Prerequisites

- Node.js >= 20.9 (developed on 24.x)
- pnpm 11
- Access to a Postgres database that supports `pgvector`. For local development
  you can use the built-in Prisma Postgres server (`pnpm db:dev`).

## Setup

```bash
pnpm install
cp .env.example .env      # then edit values (Windows: copy .env.example .env)
pnpm db:dev               # start local Prisma Postgres (keep it running)
```

`pnpm db:dev` prints the `DATABASE_URL` and `SHADOW_DATABASE_URL` (including the
ports). Copy them into `.env`.

```bash
pnpm prisma migrate reset --force   # apply migrations + seed demo data
pnpm prisma generate                # generate Prisma Client
pnpm dev                            # http://localhost:3000
```

Seeded demo accounts (password from `SEED_STAFF_PASSWORD`, default `demo-password`):

- `admin@wellnest.demo` (ADMIN)
- `frontdesk@wellnest.demo` (RECEPTIONIST)

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm smoke` | End-to-end runtime checks against a running server |
| `pnpm db:dev` | Local Prisma Postgres server |
| `pnpm db:migrate` / `db:deploy` | Apply migrations (dev / deploy) |
| `pnpm db:generate` | Regenerate Prisma Client |
| `pnpm db:seed` | Seed demo data |

## Pages

| Route | Description |
|---|---|
| `/` | Public landing / status |
| `/staff/login` | Staff sign-in |
| `/dashboard` | Staff overview |
| `/dashboard/services` | Manage services (admin only) |
| `/dashboard/providers` | Manage providers (admin only) |
| `/dashboard/schedules` | Clinic hours, provider working hours, time off (admin only) |
| `/dashboard/settings` | Booking policy and clinic settings (admin only) |

## API

All responses use the envelope `{ success, code, requestId, data, retryable }`
(see `src/lib/result.ts`). Error codes follow PRD section 16. All `/api/admin/*`
routes require an `ADMIN` staff session and enforce same-origin on mutations.

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Liveness + database connectivity |
| `/api/guest-session` | POST | Create/reuse an opaque guest session (HttpOnly cookie) |
| `/api/staff/login` | POST | Staff login, sets a DB-backed session cookie |
| `/api/staff/logout` | POST | Revoke the staff session |
| `/api/me` | GET | Current actor: `staff`, `guest`, or `anonymous` |
| `/api/admin/settings` | GET, PATCH | Clinic policy settings |
| `/api/admin/services` | GET, POST | List / create services |
| `/api/admin/services/[id]` | PATCH, DELETE | Update / deactivate a service |
| `/api/admin/providers` | GET, POST | List / create providers |
| `/api/admin/providers/[id]` | PATCH | Update a provider |
| `/api/admin/clinic-hours` | GET, PUT | Clinic opening hours |
| `/api/admin/schedules/[providerId]` | GET, PUT | Provider working hours + time off |
| `/api/admin/schedule-exceptions` | POST | Add time off |
| `/api/admin/schedule-exceptions/[id]` | DELETE | Remove time off |

## Project structure

```
prisma/
  schema.prisma            # domain schema
  migrations/              # versioned SQL (incl. pgvector extension)
  seed.ts                  # demo clinic + staff
scripts/
  smoke.mjs                # runtime smoke test
src/
  app/                     # App Router pages + API routes
  components/staff/        # client components for the staff dashboard
  lib/                     # db, env, result envelope, http, logger, rate limit
  modules/
    auth/                  # guest + staff sessions, password hashing, RBAC
    clinic/                # settings, services, providers, schedules, validation
  generated/prisma/        # generated client (gitignored)
tests/                     # Vitest unit tests
docs/SPIKE_RESULTS.md      # M0 verification evidence
```

## Known limitations

- Local Prisma Postgres (PGlite) supports only **one connection**, so it cannot
  be used for the concurrency gate. Use hosted Prisma Postgres for that.
- Rate limiting is in-memory (per instance); persistent limiting is required
  before production.
- Schedule writes currently validate against clinic hours and other working
  blocks. The "reject changes that conflict with a confirmed appointment" rule
  (PRD section 6) lands in M2 together with the appointment model and locking.
- Availability, booking, knowledge, and AI are M2–M4.

## Documentation

- [`PLAN.md`](./PLAN.md) — staged delivery plan and stack decisions
- [`docs/SPIKE_RESULTS.md`](./docs/SPIKE_RESULTS.md) — M0 spike evidence and pinned versions
