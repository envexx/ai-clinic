import { prisma } from "@/lib/db";

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
