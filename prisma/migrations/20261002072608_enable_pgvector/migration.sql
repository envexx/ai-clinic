-- Enable pgvector for the knowledge module (M3).
-- Verified on local Prisma Postgres (PGlite) and required on hosted Prisma Postgres.
CREATE EXTENSION IF NOT EXISTS vector;
