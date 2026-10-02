"use client";

import { useEffect, useState } from "react";

import {
  cardClass,
  errorClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

type InboxItem = {
  id: string;
  status: string;
  assignedStaffId: string | null;
  version: number;
  updatedAt: string;
  lastMessage: { role: string; content: string; createdAt: string } | null;
};

type Detail = {
  conversation: {
    id: string;
    status: string;
    assignedStaffId: string | null;
    version: number;
  };
  messages: { id: string; role: string; content: string; createdAt: string }[];
  notes: { id: string; authorStaffId: string; content: string; createdAt: string }[];
  tickets: { id: string; reason: string; status: string; createdAt: string }[];
};

export function InboxManager({ staffId }: { staffId: string }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      try {
        const data = await apiRequest<InboxItem[]>("/api/staff/conversations");
        if (active) setItems(data);
      } catch {
        // ignore transient polling errors
      }
    };
    void tick();
    const handle = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, []);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setError(null);
    setMessage(null);
    try {
      const data = await apiRequest<Detail>(`/api/staff/conversations/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  async function refresh() {
    if (!selectedId) return;
    try {
      const data = await apiRequest<Detail>(
        `/api/staff/conversations/${selectedId}`,
      );
      setDetail(data);
    } catch {
      // ignore
    }
  }

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(okMessage);
      await refresh();
      const data = await apiRequest<InboxItem[]>("/api/staff/conversations");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!detail) return;
    await run(
      () =>
        apiRequest(`/api/staff/conversations/${detail.conversation.id}/claim`, {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: detail.conversation.version,
          }),
        }),
      "Conversation claimed. AI is now paused.",
    );
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !reply.trim()) return;
    const value = reply;
    await run(async () => {
      await apiRequest(
        `/api/staff/conversations/${detail.conversation.id}/reply`,
        { method: "POST", body: JSON.stringify({ content: value }) },
      );
      setReply("");
    }, "Reply sent.");
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !note.trim()) return;
    const value = note;
    await run(async () => {
      await apiRequest(
        `/api/staff/conversations/${detail.conversation.id}/notes`,
        { method: "POST", body: JSON.stringify({ content: value }) },
      );
      setNote("");
    }, "Note added (staff only).");
  }

  async function resolve() {
    if (!detail) return;
    await run(
      () =>
        apiRequest(
          `/api/staff/conversations/${detail.conversation.id}/resolve`,
          {
            method: "POST",
            body: JSON.stringify({
              expectedVersion: detail.conversation.version,
            }),
          },
        ),
      "Conversation resolved.",
    );
  }

  const assignedToMe =
    detail?.conversation.assignedStaffId === staffId;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <div className={`${cardClass} max-h-[70vh] overflow-y-auto`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Conversations
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No conversations yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => selectConversation(item.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    selectedId === item.id
                      ? "border-primary bg-paper  "
                      : "border-line hover:border-primary/50 "
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {item.status}
                    </span>
                    {item.assignedStaffId === staffId && (
                      <span className="text-xs text-emerald-600">mine</span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-muted ">
                    {item.lastMessage?.content ?? "â€”"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${cardClass} flex flex-col gap-4`}>
        {!detail ? (
          <p className="text-sm text-muted">
            Select a conversation to view it.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">Status: {detail.conversation.status}</p>
                <p className="text-muted">
                  {detail.conversation.assignedStaffId
                    ? detail.conversation.assignedStaffId === staffId
                      ? "Assigned to you"
                      : "Assigned to another staff member"
                    : "Unassigned"}
                </p>
              </div>
              <div className="flex gap-2">
                {!assignedToMe && (
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={claim}
                    disabled={busy}
                  >
                    Claim
                  </button>
                )}
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={resolve}
                  disabled={busy}
                >
                  Resolve
                </button>
              </div>
            </div>

            {error && <p className={errorClass}>{error}</p>}
            {message && <p className={successClass}>{message}</p>}

            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {detail.messages.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-md px-3 py-2 text-sm ${
                    item.role === "USER"
                      ? "bg-paper "
                      : item.role === "STAFF"
                        ? "bg-emerald-50 dark:bg-emerald-950"
                        : "bg-blue-50 dark:bg-blue-950"
                  }`}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    {item.role}
                  </span>
                  <p className="whitespace-pre-wrap">{item.content}</p>
                </div>
              ))}
            </div>

            <form className="flex gap-2" onSubmit={sendReply}>
              <input
                className={inputClass}
                placeholder="Reply to visitorâ€¦"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={busy || !assignedToMe}
              />
              <button
                className={primaryButtonClass}
                type="submit"
                disabled={busy || !assignedToMe}
              >
                Send
              </button>
            </form>
            {!assignedToMe && (
              <p className="text-xs text-muted">
                Claim the conversation to reply.
              </p>
            )}

            <div className="border-t border-line pt-4 ">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Internal notes (not visible to visitor)
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {detail.notes.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950"
                  >
                    {item.content}
                  </li>
                ))}
                {detail.notes.length === 0 && (
                  <li className="text-muted">No notes.</li>
                )}
              </ul>
              <form className="mt-2 flex gap-2" onSubmit={addNote}>
                <input
                  className={inputClass}
                  placeholder="Add an internal noteâ€¦"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />
                <button
                  className={secondaryButtonClass}
                  type="submit"
                  disabled={busy}
                >
                  Add note
                </button>
              </form>
            </div>

            {detail.tickets.length > 0 && (
              <div className="text-xs text-muted">
                Handoff tickets:{" "}
                {detail.tickets
                  .map((ticket) => `${ticket.status} (${ticket.reason})`)
                  .join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
