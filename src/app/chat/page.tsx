import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Chat with the front desk
        </h1>
        <p className="mt-1 text-sm text-muted">
          Administrative questions and booking guidance. This is not medical
          advice; the assistant abstains when there is no approved source.
        </p>
      </header>
      <ChatPanel />
    </main>
  );
}
