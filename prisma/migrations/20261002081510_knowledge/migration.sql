-- CreateEnum
CREATE TYPE "KnowledgeApprovalStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISABLED');

-- CreateEnum
CREATE TYPE "KnowledgeIndexingStatus" AS ENUM ('PENDING', 'INDEXING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activeVersionId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_versions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "approvalStatus" "KnowledgeApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "indexingStatus" "KnowledgeIndexingStatus" NOT NULL DEFAULT 'PENDING',
    "embedding" vector(768),
    "error" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "indexedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "knowledge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_activeVersionId_key" ON "knowledge_documents"("activeVersionId");

-- CreateIndex
CREATE INDEX "knowledge_documents_clinicId_active_idx" ON "knowledge_documents"("clinicId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_clinicId_title_key" ON "knowledge_documents"("clinicId", "title");

-- CreateIndex
CREATE INDEX "knowledge_versions_documentId_approvalStatus_idx" ON "knowledge_versions"("documentId", "approvalStatus");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "knowledge_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector index for cosine similarity search (pgvector).
CREATE INDEX "knowledge_versions_embedding_idx"
  ON "knowledge_versions" USING hnsw (embedding vector_cosine_ops);
