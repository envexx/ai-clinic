import { KnowledgeManager } from "@/components/staff/knowledge-manager";
import { readStaffSession } from "@/modules/auth/authorize";
import { isGeminiConfigured } from "@/modules/knowledge/embeddings";
import { listDocuments } from "@/modules/knowledge/knowledge";

export default async function KnowledgePage() {
  const session = await readStaffSession();
  if (!session) return null;
  if (session.staffUser.role !== "ADMIN") {
    return (
      <p className="text-sm text-zinc-500">
        Only clinic admins can manage knowledge.
      </p>
    );
  }

  const documents = await listDocuments(session.staffUser.clinicId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
      <KnowledgeManager
        geminiConfigured={isGeminiConfigured()}
        documents={documents.map((document) => ({
          id: document.id,
          title: document.title,
          active: document.active,
          activeVersionId: document.activeVersionId,
          versions: document.versions.map((version) => ({
            id: version.id,
            content: version.content,
            sourceLabel: version.sourceLabel,
            approvalStatus: version.approvalStatus,
            indexingStatus: version.indexingStatus,
            error: version.error,
            createdAt: version.createdAt.toISOString(),
          })),
        }))}
      />
    </div>
  );
}
