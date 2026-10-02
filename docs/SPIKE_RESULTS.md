# M0 Spike Results

**Date:** 2 October 2026
**Environment:** Windows, Node v24.19.0, pnpm 11.22.0
**Database under test:** local Prisma Postgres (`prisma dev`, powered by PGlite)

This document records the M0 verification spikes defined in `PLAN.md` section 2.
It is evidence, not aspiration: each row was actually executed.

## Pinned versions

| Package | Version |
|---|---|
| next | 16.3.8 |
| react / react-dom | 19.2.8 |
| prisma (CLI) | 7.10.0 (pinned; `latest` currently points at an 8.0.0 RC) |
| @prisma/client | 7.10.0 |
| @prisma/adapter-pg | 7.10.0 |
| pg | 8.23.1 |
| zod | 4.6.5 |
| vitest | 5.0.3 |
| typescript | 5.9.3 |
| tailwindcss | 4.3.3 |

Runtime generated client path: `src/generated/prisma` (gitignored, recreated by `prisma generate`).

## Results

| Spike | Question | Result | Evidence |
|---|---|---|---|
| S-DB-1 | Does Prisma 7 + driver adapter connect and migrate against Prisma Postgres? | **PASS** | `prisma migrate dev` applied `init`, `staff_sessions`; `/api/health` reports `db: up` |
| S-DB-2 | Does `pgvector` work, including an HNSW index and cosine search? | **PASS (local)** | Migration `enable_pgvector` created `CREATE EXTENSION vector`; a probe table with an HNSW cosine index ranked `[1,0,0]` exactly: `a=0`, `c=0.0061`, `b=1` via `$queryRaw` |
| S-DB-3 | Real concurrent writes + overlap prevention? | **PENDING** | Local Prisma Postgres (PGlite) accepts **one connection at a time**, so it cannot represent true concurrency. Must run against hosted Prisma Postgres (see below). |
| S-AI-1 | Gemini free tier: text, streaming, tool calls, embeddings? | **PENDING** | Needs a `GEMINI_API_KEY`; scheduled at M4. |
| S-VER | Are versions pinned and recorded? | **PASS** | See table above; `package.json` pins Prisma 7.10.0 and Next 16.3.8 |

## Key findings and consequences

1. **pgvector works on the local Prisma Postgres**, which is better than expected. Prisma ORM still cannot read the `vector` type natively, so embeddings must be written/queried with raw SQL or TypedSQL (see PRD section 13). This is planned in module `knowledge` (M3).
2. **Local Prisma Postgres is single-connection (PGlite).** It is fine for development and for `/api/health`, auth and unit tests, but the PRD concurrency gate (`AT-08`: 20 simultaneous overlapping requests -> exactly one booking) **must run against hosted Prisma Postgres** or a full Postgres with pgvector. This is a hard requirement for M2, not a preference.
3. **Prisma 7 requires a driver adapter.** `new PrismaClient()` without an adapter throws. The app uses `@prisma/adapter-pg` with `DATABASE_URL` (works for both local and hosted Prisma Postgres).
4. **`prisma.config.ts` must be loadable before the DB is known.** It reads `DATABASE_URL` and `SHADOW_DATABASE_URL` via `env()`, so `.env` must exist before any Prisma command. A fresh `.env` is created from `.env.example`.
5. **Prisma CLI `latest` is an 8.0.0 RC** while the client is 7.10.0. We pin `prisma@7.10.0` to keep CLI and client aligned and because `prisma dev` (local Prisma Postgres) is documented for ORM 7.

## M0 outcome

Completed: project scaffold (Next.js 16 App Router, TypeScript strict), Prisma schema + migrations, `pgvector` extension migration, env validation, domain result envelope with error codes, structured logging with correlation ids, in-memory rate limiting, guest sessions, staff login/logout with scrypt + DB-backed sessions, RBAC helpers, seed, unit tests, smoke test, and this evidence.

Verified commands:

```
pnpm prisma migrate reset --force   # apply migrations + seed
pnpm typecheck                      # 0 errors
pnpm lint                           # 0 problems
pnpm test                           # 10 passed
pnpm smoke                          # 10 runtime checks passed
```

## Open item before M2

A hosted Prisma Postgres database URL (dev + a separate test database) is required to run the real concurrency gate. Until then, `AT-08` cannot be honestly verified.
