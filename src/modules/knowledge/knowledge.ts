import { createHash } from "node:crypto";

import { DomainError } from "@/lib/result";
import { prisma } from "@/lib/db";

import { embedText } from "./embeddings";
import { saveEmbedding } from "./vector-store";

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function listDocuments(clinicId: string) {
  return prisma.knowledgeDocument.findMany({
    where: { clinicId },
    orderBy: { title: "asc" },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          hash: true,
          sourceLabel: true,
          approvalStatus: true,
          indexingStatus: true,
          error: true,
          approvedAt: true,
          indexedAt: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function createDocument(
  clinicId: string,
  input: { title: string; content: string; sourceLabel?: string },
) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { clinicId, title: input.title },
    select: { id: true },
  });
  if (existing) {
    throw new DomainError("VALIDATION_ERROR", "A document with that title exists");
  }

  return prisma.knowledgeDocument.create({
    data: {
      clinicId,
      title: input.title,
      versions: {
        create: {
          content: input.content,
          hash: contentHash(input.content),
          sourceLabel: input.sourceLabel,
        },
      },
    },
    include: { versions: true },
  });
}

export async function addVersion(
  clinicId: string,
  documentId: string,
  input: { content: string; sourceLabel?: string },
) {
  const document = await prisma.knowledgeDocument.findFirst({
    where: { id: documentId, clinicId },
    select: { id: true },
  });
  if (!document) throw new DomainError("NOT_FOUND", "Document not found");

  return prisma.knowledgeVersion.create({
    data: {
      documentId,
      content: input.content,
      hash: contentHash(input.content),
      sourceLabel: input.sourceLabel,
    },
  });
}

export async function setDocumentActive(
  clinicId: string,
  documentId: string,
  active: boolean,
) {
  const document = await prisma.knowledgeDocument.findFirst({
    where: { id: documentId, clinicId },
    select: { id: true },
  });
  if (!document) throw new DomainError("NOT_FOUND", "Document not found");

  return prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { active },
  });
}

async function runIndexing(
  versionId: string,
  documentId: string,
  title: string,
  content: string,
): Promise<void> {
  await prisma.knowledgeVersion.update({
    where: { id: versionId },
    data: { indexingStatus: "INDEXING", error: null },
  });

  try {
    // Index the title together with the content so title terms are searchable.
    const vector = await embedText(`${title}\n${content}`);
    await saveEmbedding(versionId, vector);

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeVersion.update({
        where: { id: versionId },
        data: { indexingStatus: "READY", indexedAt: new Date(), error: null },
      });
      await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: { activeVersionId: versionId },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indexing failed";
    await prisma.knowledgeVersion.update({
      where: { id: versionId },
      data: { indexingStatus: "FAILED", error: message },
    });
    throw error instanceof DomainError
      ? error
      : new DomainError("SERVICE_UNAVAILABLE", "Indexing failed", true);
  }
}

export async function approveVersion(clinicId: string, versionId: string) {
  const version = await prisma.knowledgeVersion.findFirst({
    where: { id: versionId, document: { clinicId } },
    include: { document: { select: { title: true } } },
  });
  if (!version) throw new DomainError("NOT_FOUND", "Version not found");
  if (version.approvalStatus === "DISABLED") {
    throw new DomainError(
      "VALIDATION_ERROR",
      "A disabled version cannot be approved",
    );
  }

  await prisma.knowledgeVersion.update({
    where: { id: versionId },
    data: { approvalStatus: "APPROVED", approvedAt: new Date() },
  });

  await runIndexing(
    version.id,
    version.documentId,
    version.document.title,
    version.content,
  );
  return version.id;
}

export async function reindexVersion(clinicId: string, versionId: string) {
  const version = await prisma.knowledgeVersion.findFirst({
    where: { id: versionId, document: { clinicId } },
    include: { document: { select: { title: true } } },
  });
  if (!version) throw new DomainError("NOT_FOUND", "Version not found");
  if (version.approvalStatus !== "APPROVED") {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Only approved versions can be indexed",
    );
  }

  await runIndexing(
    version.id,
    version.documentId,
    version.document.title,
    version.content,
  );
  return version.id;
}

export async function disableVersion(clinicId: string, versionId: string) {
  const version = await prisma.knowledgeVersion.findFirst({
    where: { id: versionId, document: { clinicId } },
    select: { id: true },
  });
  if (!version) throw new DomainError("NOT_FOUND", "Version not found");

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeVersion.update({
      where: { id: versionId },
      data: { approvalStatus: "DISABLED" },
    });
    await tx.knowledgeDocument.updateMany({
      where: { activeVersionId: versionId },
      data: { activeVersionId: null },
    });
  });
}
