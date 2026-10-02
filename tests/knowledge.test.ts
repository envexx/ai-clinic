import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSION,
  localEmbed,
} from "@/modules/knowledge/embeddings";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

describe("local embedding fallback", () => {
  it("produces a fixed-dimension normalized vector", () => {
    const vector = localEmbed("opening hours and booking policy");
    expect(vector).toHaveLength(EMBEDDING_DIMENSION);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic", () => {
    expect(localEmbed("dental cleaning")).toEqual(localEmbed("dental cleaning"));
  });

  it("scores related text higher than unrelated text", () => {
    const query = localEmbed("when is the clinic open on saturday");
    const related = localEmbed(
      "the clinic is open on Saturday from 10:00 to 14:00",
    );
    const unrelated = localEmbed(
      "payment methods accepted include major cards at the front desk",
    );
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });
});
