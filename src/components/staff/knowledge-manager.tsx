"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cardClass,
  dangerButtonClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

export type VersionRow = {
  id: string;
  content: string;
  sourceLabel: string | null;
  approvalStatus: "DRAFT" | "APPROVED" | "DISABLED";
  indexingStatus: "PENDING" | "INDEXING" | "READY" | "FAILED";
  error: string | null;
  createdAt: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  active: boolean;
  activeVersionId: string | null;
  versions: VersionRow[];
};

type Citation = {
  documentId: string;
  versionId: string;
  title: string;
  sourceLabel: string | null;
  excerpt: string;
  score: number;
};

function statusLabel(version: VersionRow): string {
  return `${version.approvalStatus}/${version.indexingStatus}`;
}

export function KnowledgeManager({
  documents,
  geminiConfigured,
}: {
  documents: DocumentRow[];
  geminiConfigured: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [newVersion, setNewVersion] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(okMessage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDocument(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      await apiRequest("/api/admin/knowledge", {
        method: "POST",
        body: JSON.stringify({ title, content, sourceLabel: sourceLabel || undefined }),
      });
      setTitle("");
      setContent("");
      setSourceLabel("");
    }, "Document created (DRAFT).");
  }

  async function addVersion(documentId: string) {
    const value = newVersion[documentId]?.trim();
    if (!value) return;
    await run(async () => {
      await apiRequest(`/api/admin/knowledge/${documentId}/versions`, {
        method: "POST",
        body: JSON.stringify({ content: value }),
      });
      setNewVersion((current) => ({ ...current, [documentId]: "" }));
    }, "New version created (DRAFT).");
  }

  async function approve(versionId: string) {
    await run(
      () =>
        apiRequest(
          `/api/admin/knowledge/versions/${versionId}/approve`,
          { method: "POST" },
        ),
      "Version approved and indexed.",
    );
  }

  async function disable(versionId: string) {
    await run(
      () =>
        apiRequest(
          `/api/admin/knowledge/versions/${versionId}/disable`,
          { method: "POST" },
        ),
      "Version disabled.",
    );
  }

  async function reindex(versionId: string) {
    await run(
      () =>
        apiRequest(
          `/api/admin/knowledge/versions/${versionId}/reindex`,
          { method: "POST" },
        ),
      "Reindexed.",
    );
  }

  async function toggleDocument(document: DocumentRow) {
    await run(
      () =>
        apiRequest(`/api/admin/knowledge/${document.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: !document.active }),
        }),
      document.active ? "Document disabled." : "Document enabled.",
    );
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<Citation[]>(
        `/api/admin/knowledge/search?q=${encodeURIComponent(query)}`,
      );
      setCitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Embedding provider:{" "}
        <strong>{geminiConfigured ? "Gemini" : "local fallback (no API key)"}</strong>
        . Only the active version that is APPROVED + READY is retrievable.
      </p>

      {error && <p className={errorClass}>{error}</p>}
      {message && <p className={successClass}>{message}</p>}

      <form className={cardClass} onSubmit={search}>
        <h2 className="text-lg font-semibold">Test retrieval</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className={`${labelClass} flex-1`}>
            Query
            <input
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. how much is a dental cleaning"
            />
          </label>
          <button className={primaryButtonClass} type="submit" disabled={busy}>
            Search
          </button>
        </div>
        {citations.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {citations.map((citation) => (
              <li
                key={citation.versionId}
                className="rounded-lg border border-border p-3 "
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{citation.title}</span>
                  <span className="text-xs text-muted-foreground">
                    score {citation.score.toFixed(3)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground ">
                  {citation.excerpt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </form>

      <form className={cardClass} onSubmit={createDocument}>
        <h2 className="text-lg font-semibold">New document</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Title
            <input
              className={inputClass}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Source label (optional)
            <input
              className={inputClass}
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
            />
          </label>
        </div>
        <label className={`${labelClass} mt-4`}>
          Content
          <textarea
            className={`${inputClass} min-h-24`}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <div className="mt-4">
          <button className={primaryButtonClass} type="submit" disabled={busy}>
            Create document
          </button>
        </div>
      </form>

      {documents.map((document) => (
        <section key={document.id} className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{document.title}</h2>
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => toggleDocument(document)}
              disabled={busy}
            >
              {document.active ? "Disable document" : "Enable document"}
            </button>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {document.versions.map((version) => (
              <li
                key={version.id}
                className="rounded-lg border border-border p-3 text-sm "
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {statusLabel(version)}
                    {document.activeVersionId === version.id && (
                      <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        active
                      </span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {version.approvalStatus === "DRAFT" && (
                      <button
                        className={primaryButtonClass}
                        type="button"
                        onClick={() => approve(version.id)}
                        disabled={busy}
                      >
                        Approve
                      </button>
                    )}
                    {version.approvalStatus === "APPROVED" &&
                      version.indexingStatus === "FAILED" && (
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => reindex(version.id)}
                          disabled={busy}
                        >
                          Retry indexing
                        </button>
                      )}
                    {version.approvalStatus !== "DISABLED" && (
                      <button
                        className={dangerButtonClass}
                        type="button"
                        onClick={() => disable(version.id)}
                        disabled={busy}
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-muted-foreground ">
                  {version.content}
                </p>
                {version.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {version.error}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <label className={labelClass}>
              New version content
              <textarea
                className={`${inputClass} min-h-20`}
                value={newVersion[document.id] ?? ""}
                onChange={(e) =>
                  setNewVersion((current) => ({
                    ...current,
                    [document.id]: e.target.value,
                  }))
                }
              />
            </label>
            <button
              className={`${secondaryButtonClass} mt-2`}
              type="button"
              onClick={() => addVersion(document.id)}
              disabled={busy}
            >
              Add version
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
