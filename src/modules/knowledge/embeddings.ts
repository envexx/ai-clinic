import { DomainError } from "@/lib/result";

export const EMBEDDING_DIMENSION = 768;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return values;
  return values.map((value) => value / norm);
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "is",
  "are", "was", "were", "be", "been", "do", "does", "did", "you", "your", "i",
  "we", "it", "this", "that", "these", "those", "what", "when", "where",
  "which", "who", "how", "can", "could", "will", "would", "should", "my", "me",
  "us", "our", "with", "from", "by", "as", "if", "then", "than", "but", "not",
  "no", "yes", "have", "has", "had", "please", "hi", "hello", "there", "here",
]);

/**
 * Deterministic local embedding used when GEMINI_API_KEY is not configured.
 * It is a lexical bag-of-words hash with stopwords removed, not a semantic
 * model: good enough to exercise the pipeline and tests offline.
 */
export function localEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => !STOPWORDS.has(token),
  );
  for (const token of tokens) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const bucket = Math.abs(hash) % EMBEDDING_DIMENSION;
    vector[bucket] += 1;
  }
  return normalize(vector);
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function embedWithGemini(text: string): Promise<number[]> {
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  const response = await fetch(
    `${GEMINI_BASE}/${model}:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
    },
  );

  if (!response.ok) {
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      `Embedding provider error (${response.status})`,
      true,
    );
  }

  const json = (await response.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "Embedding provider returned no vector",
      true,
    );
  }
  return normalize(values);
}

// Gemini embedding input limit is 2048 tokens; keep a safe character budget.
const MAX_INPUT_CHARS = 6000;

export async function embedText(text: string): Promise<number[]> {
  const input = text.slice(0, MAX_INPUT_CHARS);
  if (isGeminiConfigured()) {
    return embedWithGemini(input);
  }
  return localEmbed(input);
}
