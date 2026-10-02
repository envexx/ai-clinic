"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Clock,
  Inbox as InboxIcon,
  Mail,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  UserCheck,
} from "lucide-react";
import gsap from "gsap";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type InboxItem = {
  id: string;
  status: string;
  assignedStaffId: string | null;
  version: number;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  contactName: string;
  contact: string | null;
  lastMessage: { role: string; content: string; createdAt: string } | null;
};

type Detail = {
  conversation: {
    id: string;
    status: string;
    assignedStaffId: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  visitor: { displayName: string; contact: string } | null;
  assignedStaff: { id: string; email: string; role: string } | null;
  messages: { id: string; role: string; content: string; createdAt: string }[];
  notes: { id: string; content: string; createdAt: string }[];
  tickets: { id: string; reason: string; status: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  AI_ACTIVE: "bg-muted text-muted-foreground",
  WAITING_HUMAN: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  HUMAN_ACTIVE: "bg-primary/10 text-primary",
  RESOLVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const STATUS_LABEL: Record<string, string> = {
  AI_ACTIVE: "AI handling",
  WAITING_HUMAN: "Waiting",
  HUMAN_ACTIVE: "Assigned",
  RESOLVED: "Resolved",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Strip lightweight markdown so stored replies read as plain text. */
function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)\*/g, "$1$2");
}

function duration(fromIso: string, toIso: string): string {
  const minutes = Math.max(
    1,
    Math.round(
      (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000,
    ),
  );
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function InboxManager({
  staffId,
  staffRole,
  staffEmail,
}: {
  staffId: string;
  staffRole: string;
  staffEmail: string;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [tab, setTab] = useState<"all" | "mine" | "unassigned">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastAnimatedKey = useRef("");

  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const data = await apiRequest<InboxItem[]>("/api/staff/conversations");
        if (active) {
          // Only replace state when something actually changed.
          setItems((prev) =>
            JSON.stringify(prev) === JSON.stringify(data) ? prev : data,
          );
        }
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

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const data = await apiRequest<Detail>(
          `/api/staff/conversations/${selectedId}`,
        );
        if (active) {
          // Keep the same object when nothing changed so the thread is stable.
          setDetail((prev) =>
            prev && JSON.stringify(prev) === JSON.stringify(data) ? prev : data,
          );
        }
      } catch {
        // ignore
      }
    };
    void tick();
    const handle = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, [selectedId]);

  // One authored moment: animate only when opening a conversation or when a
  // new message arrives — never on a background poll.
  useEffect(() => {
    if (!threadRef.current || !detail) return;
    const key = `${detail.conversation.id}:${detail.messages.length}`;
    if (lastAnimatedKey.current === key) return;

    const nodes = Array.from(
      threadRef.current.querySelectorAll("[data-message]"),
    );
    if (nodes.length === 0) return;

    const sameConversation = lastAnimatedKey.current.startsWith(
      `${detail.conversation.id}:`,
    );
    lastAnimatedKey.current = key;

    const targets = sameConversation ? nodes.slice(-1) : nodes;
    gsap.fromTo(
      targets,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.32,
        ease: "power2.out",
        stagger: 0.03,
        overwrite: true,
      },
    );
  }, [detail]);

  const filtered = items.filter((item) => {
    if (tab === "mine") return item.assignedStaffId === staffId;
    if (tab === "unassigned") return !item.assignedStaffId;
    return true;
  });

  const assignedToMe = detail?.conversation.assignedStaffId === staffId;
  const canReply = assignedToMe || staffRole === "ADMIN";

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (selectedId) {
        const data = await apiRequest<Detail>(
          `/api/staff/conversations/${selectedId}`,
        );
        setDetail(data);
      }
      const list = await apiRequest<InboxItem[]>("/api/staff/conversations");
      setItems(list);
      void message;
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
          body: JSON.stringify({ expectedVersion: detail.conversation.version }),
        }),
      "claimed",
    );
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
      "resolved",
    );
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    const value = reply;
    setReply("");
    await run(
      () =>
        apiRequest(`/api/staff/conversations/${detail.conversation.id}/reply`, {
          method: "POST",
          body: JSON.stringify({ content: value }),
        }),
      "sent",
    );
  }

  async function addNote() {
    if (!detail || !note.trim()) return;
    const value = note;
    setNote("");
    await run(
      () =>
        apiRequest(`/api/staff/conversations/${detail.conversation.id}/notes`, {
          method: "POST",
          body: JSON.stringify({ content: value }),
        }),
      "noted",
    );
  }

  const openTicket = detail?.tickets.find((ticket) => ticket.status === "OPEN");

  return (
    <TooltipProvider>
      <div className="flex h-[70vh] overflow-hidden rounded-xl border bg-card shadow-sm lg:h-[calc(100vh-6.5rem)]">
        {/* Conversation list */}
        <section
          className={cn(
            "w-full shrink-0 flex-col border-r md:flex md:w-72",
            selectedId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <InboxIcon className="size-4" strokeWidth={1.75} />
              All chats
              <span className="text-muted-foreground">{items.length}</span>
            </div>
            <Button size="icon" variant="ghost" className="size-7" aria-label="New chat">
              <Plus className="size-4" />
            </Button>
          </div>
          <Separator />
          <div className="flex gap-1 px-3 py-2 text-xs">
            {(
              [
                ["all", "All"],
                ["mine", "Mine"],
                ["unassigned", "Unassigned"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  tab === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No conversations.
              </p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid="conversation-item"
                onClick={() => {
                  setSelectedId(item.id);
                  setDetail(null);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors",
                  selectedId === item.id
                    ? "bg-accent"
                    : "hover:bg-accent/60",
                )}
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(item.contactName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.contactName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(item.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.lastMessage
                      ? plainText(item.lastMessage.content)
                      : "No messages yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Thread */}
        <section
          className={cn(
            "min-w-0 flex-1 flex-col",
            selectedId ? "flex" : "hidden md:flex",
          )}
        >
          {!detail ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Choose a chat from the list to read the history and reply.
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                Signed in as {staffEmail}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="md:hidden"
                    aria-label="Back to conversations"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(
                        detail.visitor?.displayName ??
                          detail.conversation.id.slice(0, 2),
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {detail.visitor?.displayName ?? "Visitor"}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                          STATUS_STYLE[detail.conversation.status],
                        )}
                      >
                        {STATUS_LABEL[detail.conversation.status]}
                      </span>
                      {detail.assignedStaff && (
                        <span>· {detail.assignedStaff.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!assignedToMe && (
                    <Button size="sm" onClick={claim} disabled={busy}>
                      <UserCheck className="size-4" />
                      Claim
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resolve}
                    disabled={busy}
                  >
                    <CheckCheck className="size-4" />
                    Resolve
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="More actions"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={claim}>Claim</DropdownMenuItem>
                      <DropdownMenuItem onClick={resolve}>Resolve</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {error && (
                <p className="mx-5 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div
                ref={threadRef}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                {detail.messages.map((message) => {
                  const isVisitor = message.role === "USER";
                  return (
                    <div
                      key={message.id}
                      data-message
                      className={cn(
                        "mb-4 flex max-w-[80%] gap-2.5",
                        isVisitor ? "mr-auto" : "ml-auto flex-row-reverse",
                      )}
                    >
                      <Avatar className="mt-5 size-7 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-[10px] font-semibold",
                            isVisitor
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {isVisitor
                            ? initials(detail.visitor?.displayName ?? "V")
                            : "AI"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "mb-1 flex items-center gap-2 text-[11px] text-muted-foreground",
                            isVisitor ? "" : "justify-end",
                          )}
                        >
                          <span>
                            {isVisitor
                              ? detail.visitor?.displayName ?? "Visitor"
                              : message.role === "STAFF"
                                ? "Agent"
                                : "AI assistant"}
                          </span>
                          <span>{clock(message.createdAt)}</span>
                        </div>
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                            isVisitor
                              ? "rounded-tl-sm bg-muted"
                              : "rounded-tr-sm bg-primary/10 text-foreground",
                          )}
                        >
                          {plainText(message.content)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t p-3">
                <div className="rounded-lg border">
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={
                      canReply
                        ? "Write a reply…"
                        : "Claim this conversation to reply"
                    }
                    disabled={!canReply || busy}
                    className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                        Message
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" aria-label="Emoji">
                        <Smile className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" aria-label="Attach">
                        <Paperclip className="size-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={sendReply}
                      disabled={!canReply || busy || !reply.trim()}
                    >
                      <Send className="size-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Details */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l xl:flex">
          {detail ? (
            <>
              <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                    {initials(detail.visitor?.displayName ?? "Visitor")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {detail.visitor?.displayName ?? "Visitor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABEL[detail.conversation.status]}
                  </p>
                </div>
              </div>
              <Separator />

              <div className="flex flex-col gap-2 px-5 py-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" />
                  <span className="truncate text-foreground">
                    {detail.visitor?.contact ?? "No contact provided"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4" />
                  <span className="text-foreground">
                    {duration(
                      detail.conversation.createdAt,
                      detail.conversation.updatedAt,
                    )}
                  </span>
                </div>
              </div>
              <Separator />

              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chat info
                </p>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge variant="secondary" className="font-normal">
                        {detail.conversation.status}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Chat ID</dt>
                    <dd className="font-mono text-xs">
                      {detail.conversation.id.slice(0, 8)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Started</dt>
                    <dd>{clock(detail.conversation.createdAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Messages</dt>
                    <dd>{detail.messages.length}</dd>
                  </div>
                </dl>
              </div>

              <Separator />
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chat tags
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {openTicket ? (
                    <Badge variant="outline" className="font-normal">
                      {openTicket.reason}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>

              <Separator />
              <div className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Internal notes
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {detail.notes.map((item) => (
                    <p
                      key={item.id}
                      className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300"
                    >
                      {item.content}
                    </p>
                  ))}
                  {detail.notes.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No notes yet.
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add a staff-only note"
                    className="min-h-9 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addNote}
                    disabled={busy || !note.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Details appear here.
            </div>
          )}
        </aside>
      </div>
    </TooltipProvider>
  );
}
