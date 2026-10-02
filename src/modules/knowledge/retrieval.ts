import { logger } from "@/lib/logger";

import { embedText } from "./embeddings";
import { keywordSearch, vectorSearch, type KnowledgeHit } from "./vector-store";

export type KnowledgeCitation = {
  documentId: string;
  versionId: string;
  title: string;
  sourceLabel: string | null;
  excerpt: string;
  score: number;
};

const EXCERPT_LENGTH = 280;

function toCitation(hit: KnowledgeHit): KnowledgeCitation {
  return {
    documentId: hit.documentId,
    versionId: hit.versionId,
    title: hit.title,
    sourceLabel: hit.sourceLabel,
    excerpt: hit.content.slice(0, EXCERPT_LENGTH),
    score: Number(hit.score),
  };
}

/**
 * Retrieves approved clinic knowledge. The vector path is preferred; if the
 * embedding provider fails, it degrades to keyword search rather than
 * returning fabricated answers.
 */
export async function searchKnowledge(
  clinicId: string,
  query: string,
  limit = 5,
): Promise<KnowledgeCitation[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let hits: KnowledgeHit[];
  try {
    const vector = await embedText(trimmed);
    hits = await vectorSearch(clinicId, vector, limit);
  } catch (error) {
    logger.warn("knowledge.vector_search_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    hits = await keywordSearch(clinicId, trimmed, limit);
  }

  return hits.map(toCitation);
}
