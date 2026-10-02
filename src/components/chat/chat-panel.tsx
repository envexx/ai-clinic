"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  cardClass,
  errorClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

type Citation = {
  versionId: string;
  title: string;
  sourceLabel: string | null;
  excerpt: string;
  score: number;
};

type PendingAction = {
  actionId: string;
  type: string;
  expiresAt: string;
  summary: Record<string, unknown>;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "TOOL" | "SYSTEM";
  content: string;
  citations: Citation[];
  pendingAction?: PendingAction | null;
};

type ChatReply = {
  conversationId: string;
  reply: string;
  citations: Citation[];
  pendingAction: PendingAction | null;
  handoff: boolean;
};

type HistoryResponse = {
  conversationId: string;
  status: string;
  messages: {
    id: string;
    role: ChatMessage["role"];
    content: string;
    citations: Citation[];
  }[];
};

function summaryLine(action: PendingAction): string {
  const summary = action.summary as {
    serviceName?: string;
    providerName?: string;
    startAt?: string;
    displayName?: string;
  };
  const parts = [
    summary.serviceName,
    summary.providerName,
    summary.startAt
      ? new Date(summary.startAt).toLocaleString("en-GB", {
          timeZone: "Asia/Dubai",
        })
      : undefined,
  ].filter(Boolean);
  return parts.join(" Â· ");
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await apiRequest("/api/guest-session", { method: "POST" });
        const history = await apiRequest<HistoryResponse>("/api/chat");
        if (active) {
          setMessages(
            history.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              citations: message.citations ?? [],
            })),
          );
        }
      } catch {
        // A fresh session may simply have no history yet.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;

    const clientMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: clientMessageId, role: "USER", content: text, citations: [] },
    ]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      await apiRequest("/api/guest-session", { method: "POST" });
      const reply = await apiRequest<ChatReply>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, clientMessageId }),
      });
      setMessages((current) => [
        ...current,
        {
          id: `${clientMessageId}-assistant`,
          role: "ASSISTANT",
          content: reply.reply,
          citations: reply.citations,
          pendingAction: reply.pendingAction,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(message: ChatMessage) {
    if (!message.pendingAction) return;
    setBusy(true);
    setError(null);
    try {
      const appointment = await apiRequest<{
        bookingReference: string;
      }>(`/api/actions/${message.pendingAction.actionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: `Confirmed. Your booking reference is ${appointment.bookingReference}. You can see it on the My appointments page.`,
          citations: [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className={`${cardClass} flex max-h-[60vh] flex-col gap-3 overflow-y-auto`}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Ask about services, prices, opening hours or booking. Try â€œwhat are
            your opening hours?â€ or â€œhow much is a dental cleaning?â€.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "USER"
                ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-fg"
                : "max-w-[85%] self-start rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-sm"
            }
          >
            <p className="whitespace-pre-wrap">{message.content}</p>

            {message.citations.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs ">
                <span className="font-medium uppercase tracking-wide text-muted">
                  Sources
                </span>
                {message.citations.map((citation) => (
                  <span key={citation.versionId}>
                    {citation.title}
                    {citation.sourceLabel ? ` (${citation.sourceLabel})` : ""}
                  </span>
                ))}
              </div>
            )}

            {message.pendingAction && (
              <div className="mt-2 rounded-lg border border-line bg-surface p-2 text-xs  ">
                <p className="font-medium">
                  {message.pendingAction.type.replace(/_/g, " ").toLowerCase()}
                </p>
                <p className="mt-1">{summaryLine(message.pendingAction)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    className={primaryButtonClass}
                    type="button"
                    onClick={() => confirm(message)}
                    disabled={busy}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <p role="status" aria-live="polite" className="self-start text-xs text-muted">
            Thinkingâ€¦
          </p>
        )}
      </div>

      {error && <p className={errorClass}>{error}</p>}

      <form className="flex gap-2" onSubmit={send}>
        <input
          className={inputClass}
          placeholder="Type a messageâ€¦"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className={primaryButtonClass} type="submit" disabled={busy}>
          Send
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className={secondaryButtonClass} href="/book">
          Book manually
        </Link>
        <Link className={secondaryButtonClass} href="/my-appointments">
          My appointments
        </Link>
      </div>
    </div>
  );
}
