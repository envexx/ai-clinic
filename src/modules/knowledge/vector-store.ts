import { prisma } from "@/lib/db";

import { contentTokens } from "./embeddings";

export type KnowledgeHit = {
  documentId: string;
  versionId: string;
  title: string;
  sourceLabel: string | null;
  content: string;
  score: number;
};

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

/** Writes the pgvector column with raw SQL (Prisma cannot type `vector`). */
export async function saveEmbedding(
  versionId: string,
  values: number[],
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "knowledge_versions" SET embedding = $1::vector WHERE id = $2::uuid`,
    toVectorLiteral(values),
    versionId,
  );
}

/**
 * Cosine similarity search. The database is the authority: only the active
 * version of an active document that is APPROVED + READY is eligible.
 */
export async function vectorSearch(
  clinicId: string,
  values: number[],
  limit: number,
): Promise<KnowledgeHit[]> {
  return prisma.$queryRawUnsafe<KnowledgeHit[]>(
    `SELECT d.id AS "documentId",
            v.id AS "versionId",
            d.title,
            v."sourceLabel",
            v.content,
            1 - (v.embedding <=> $1::vector) AS score
       FROM "knowledge_versions" v
       JOIN "knowledge_documents" d ON d.id = v."documentId"
      WHERE d."clinicId" = $2::uuid
        AND d.active = true
        AND v."approvalStatus" = 'APPROVED'
        AND v."indexingStatus" = 'READY'
        AND d."activeVersionId" = v.id
        AND v.embedding IS NOT NULL
      ORDER BY v.embedding <=> $1::vector
      LIMIT $3`,
    toVectorLiteral(values),
    clinicId,
    limit,
  );
}

/**
 * Deterministic lexical search used when no embedding provider is configured.
 * It requires at least half of the query's content tokens to appear in the
 * document, which makes the assistant abstain on unrelated questions.
 */
export async function lexicalSearch(
  clinicId: string,
  query: string,
  limit: number,
): Promise<KnowledgeHit[]> {
  const queryTokens = new Set(contentTokens(query));
  if (queryTokens.size === 0) return [];

  const documents = await prisma.$queryRawUnsafe<KnowledgeHit[]>(
    `SELECT d.id AS "documentId",
            v.id AS "versionId",
            d.title,
            v."sourceLabel",
            v.content,
            0::float8 AS score
       FROM "knowledge_versions" v
       JOIN "knowledge_documents" d ON d.id = v."documentId"
      WHERE d."clinicId" = $1::uuid
        AND d.active = true
        AND v."approvalStatus" = 'APPROVED'
        AND v."indexingStatus" = 'READY'
        AND d."activeVersionId" = v.id`,
    clinicId,
  );

  return documents
    .map((document) => {
      const documentTokens = new Set(
        contentTokens(`${document.title} ${document.content}`),
      );
      let shared = 0;
      for (const token of queryTokens) {
        if (documentTokens.has(token)) shared += 1;
      }
      return { ...document, score: shared / queryTokens.size };
    })
    .filter((document) => document.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Degraded keyword search used when the embedding provider is unavailable. */
export async function keywordSearch(
  clinicId: string,
  query: string,
  limit: number,
): Promise<KnowledgeHit[]> {
  const term = `%${query.trim()}%`;
  return prisma.$queryRawUnsafe<KnowledgeHit[]>(
    `SELECT d.id AS "documentId",
            v.id AS "versionId",
            d.title,
            v."sourceLabel",
            v.content,
            0.5::float8 AS score
       FROM "knowledge_versions" v
       JOIN "knowledge_documents" d ON d.id = v."documentId"
      WHERE d."clinicId" = $1::uuid
        AND d.active = true
        AND v."approvalStatus" = 'APPROVED'
        AND v."indexingStatus" = 'READY'
        AND d."activeVersionId" = v.id
        AND (v.content ILIKE $2 OR d.title ILIKE $2)
      LIMIT $3`,
    clinicId,
    term,
    limit,
  );
}
