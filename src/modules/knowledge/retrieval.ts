import { logger } from "@/lib/logger";

import { embedText, isGeminiConfigured } from "./embeddings";
import {
  keywordSearch,
  lexicalSearch,
  vectorSearch,
  type KnowledgeHit,
} from "./vector-store";

export type KnowledgeCitation = {
  documentId: string;
  versionId: string;
  title: string;
  sourceLabel: string | null;
  excerpt: string;
  score: number;
};

const EXCERPT_LENGTH = 280;

/**
 * Minimum similarity to count as a grounded hit. Below this the assistant must
 * abstain instead of answering from a weak match.
 */
const MIN_SCORE = 0.1;

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

  // Without an embedding provider we use a strict lexical match, which
  // abstains reliably on unrelated questions.
  if (!isGeminiConfigured()) {
    const hits = await lexicalSearch(clinicId, trimmed, limit);
    return hits.map(toCitation);
  }

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

  return hits
    .map(toCitation)
    .filter((citation) => citation.score >= MIN_SCORE);
}
