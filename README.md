# AI Clinic Front Desk

AI receptionist MVP for a wellness/aesthetics clinic: visitors can ask
administrative questions, book/reschedule/cancel appointments, and hand off to
staff. Staff use a dashboard to manage the same appointments and conversations.

This repository currently implements **M0 – Foundation**, **M1 – Clinic
configuration**, **M2 – Booking domain**, and **M3 – Knowledge**. The product
requirements live in
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
| `pnpm test` | Vitest unit tests (no database needed) |
| `pnpm test:integration` | Vitest integration tests (needs a running database) |
| `pnpm smoke` | End-to-end runtime checks against a running server |
| `pnpm db:dev` | Local Prisma Postgres server |
| `pnpm db:migrate` / `db:deploy` | Apply migrations (dev / deploy) |
| `pnpm db:generate` | Regenerate Prisma Client |
| `pnpm db:seed` | Seed demo data |

## Pages

| Route | Description |
|---|---|
| `/` | Public landing / status |
| `/book` | Visitor booking flow: slots, contact, confirm |
| `/my-appointments` | Visitor appointments for this browser session |
| `/staff/login` | Staff sign-in |
| `/dashboard` | Staff overview |
| `/dashboard/services` | Manage services (admin only) |
| `/dashboard/providers` | Manage providers (admin only) |
| `/dashboard/schedules` | Clinic hours, provider working hours, time off (admin only) |
| `/dashboard/knowledge` | Knowledge documents, versions, approval, retrieval test (admin only) |
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
| `/api/services` | GET | Public list of active services |
| `/api/availability` | GET | Free slots for a service (no patient data) |
| `/api/bookings` | POST | Prepare a booking (creates a pending action) |
| `/api/bookings/reschedule` | POST | Prepare a reschedule |
| `/api/bookings/cancel` | POST | Prepare a cancellation |
| `/api/actions/[id]/confirm` | POST | Execute a pending action (guest-owned, idempotent) |
| `/api/my-appointments` | GET | Appointments owned by the guest session |
| `/api/staff/appointments/[id]` | PATCH | Staff status transition (audited) |
| `/api/admin/knowledge` | GET, POST | List / create knowledge documents |
| `/api/admin/knowledge/[documentId]` | PATCH | Enable/disable a document |
| `/api/admin/knowledge/[documentId]/versions` | POST | Add a new draft version |
| `/api/admin/knowledge/versions/[versionId]/approve` | POST | Approve + index a version |
| `/api/admin/knowledge/versions/[versionId]/disable` | POST | Disable a version |
| `/api/admin/knowledge/versions/[versionId]/reindex` | POST | Retry indexing |
| `/api/admin/knowledge/search` | GET | Retrieval test (returns citations) |

### Booking model

- Booking never happens from a model's text: the server creates a versioned,
  hashed, single-use **pending action**; only the owning guest session can
  confirm it, with an idempotency key.
- Overlaps are prevented at two levels: an application check and a Postgres
  **exclusion constraint** on `provider + tstzrange(startAt, occupiedEnd)` for
  active appointments (verified working on local Prisma Postgres).
- Every mutation writes an `audit_events` row in the same transaction.

### Knowledge retrieval (no external memory service)

- Documents have immutable versions; editing creates a new DRAFT version. The
  previous version stays active until the new one is **APPROVED + READY**.
- Embeddings are stored in a `vector(768)` column with an HNSW cosine index
  (`pgvector`). Prisma cannot type `vector`, so it is read/written with raw SQL.
- Retrieval always re-validates against the database: only the active version of
  an active document that is APPROVED + READY is eligible. `DISABLED` versions
  drop out immediately.
- Embeddings use **Gemini** (`gemini-embedding-001`) when `GEMINI_API_KEY` is
  set; otherwise a deterministic local fallback is used so the pipeline and
  tests work offline. Retrieval degrades to keyword search if the provider
  fails, and never fabricates an answer.

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
  components/
    booking/               # visitor booking flow (client)
    staff/                 # staff dashboard components (client)
  lib/                     # db, env, result envelope, http, logger, rate limit
  modules/
    auth/                  # guest + staff sessions, password hashing, RBAC
    clinic/                # settings, services, providers, schedules, validation
    scheduling/            # timezone-aware availability engine
    appointments/          # booking domain: actions, idempotency, create/reschedule/cancel
    knowledge/             # documents, versions, embeddings, pgvector retrieval
    audit/                 # audit event writer
  generated/prisma/        # generated client (gitignored)
tests/                     # Vitest unit tests
tests/integration/         # database-backed tests (pnpm test:integration)
docs/SPIKE_RESULTS.md      # M0 verification evidence
```

## Known limitations

- Local Prisma Postgres (PGlite) supports only **one connection**, so it cannot
  be used for the concurrency gate. Use hosted Prisma Postgres for that.
- Rate limiting is in-memory (per instance); persistent limiting is required
  before production.
- The **true parallel concurrency gate** (`AT-08`: 20 simultaneous requests for
  one slot) is written but skipped by default, because local Prisma Postgres is
  single-connection and crashes under concurrent transactions. Run it against
  hosted Prisma Postgres with `RUN_CONCURRENCY_GATE=1 pnpm test:integration`.
  A deterministic 20-attempt test passes locally today.
- Schedule changes are not yet rejected when they conflict with a **confirmed
  appointment** (PRD section 6); that check arrives with the staff appointment
  dashboard in M5. Capacity conflicts are still impossible because of the
  exclusion constraint.
- Reschedule/cancel have API and domain support but no visitor UI yet.
- Without `GEMINI_API_KEY`, embeddings use a lexical local fallback. Semantic
  quality requires the real Gemini embedding model.
- The chat agent (streaming, tools, citations in conversation) is M4.

## Documentation

- [`PLAN.md`](./PLAN.md) — staged delivery plan and stack decisions
- [`docs/SPIKE_RESULTS.md`](./docs/SPIKE_RESULTS.md) — M0 spike evidence and pinned versions
