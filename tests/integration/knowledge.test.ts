import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  approveVersion,
  createDocument,
  disableVersion,
} from "@/modules/knowledge/knowledge";
import { searchKnowledge } from "@/modules/knowledge/retrieval";

let clinicId: string;
const createdDocumentIds: string[] = [];

beforeAll(async () => {
  const clinic = await prisma.clinic.findFirstOrThrow();
  clinicId = clinic.id;
});

afterAll(async () => {
  if (createdDocumentIds.length) {
    await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: createdDocumentIds } },
    });
  }
});

describe("knowledge lifecycle and retrieval", () => {
  it("retrieves seeded approved knowledge", async () => {
    const hits = await searchKnowledge(clinicId, "what are the opening hours", 5);
    expect(hits.some((hit) => hit.title === "Opening hours")).toBe(true);
  });

  it("only retrieves APPROVED+READY and drops DISABLED versions", async () => {
    const title = `Test policy ${Date.now()}`;
    const content =
      "The clinic offers a complimentary herbal tea to every visitor in the lounge.";
    const document = await createDocument(clinicId, {
      title,
      content,
      sourceLabel: "integration-test",
    });
    createdDocumentIds.push(document.id);
    const versionId = document.versions[0].id;

    // DRAFT: not retrievable.
    let hits = await searchKnowledge(
      clinicId,
      "complimentary herbal tea in the lounge",
      5,
    );
    expect(hits.some((hit) => hit.versionId === versionId)).toBe(false);

    // APPROVED + READY: retrievable.
    await approveVersion(clinicId, versionId);
    hits = await searchKnowledge(
      clinicId,
      "complimentary herbal tea in the lounge",
      5,
    );
    expect(hits.some((hit) => hit.versionId === versionId)).toBe(true);

    // DISABLED: immediately excluded.
    await disableVersion(clinicId, versionId);
    hits = await searchKnowledge(
      clinicId,
      "complimentary herbal tea in the lounge",
      5,
    );
    expect(hits.some((hit) => hit.versionId === versionId)).toBe(false);
  });
});
