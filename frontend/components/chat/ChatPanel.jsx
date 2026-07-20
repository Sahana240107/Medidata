"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/lib/hooks/useChat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

const SUGGESTIONS = [
  "Most common symptoms of Behçet's disease?",
  "What countries have the most cases of Tuberculosis?",
  "Differentiate Type 1 Diabetes from Type 2 Diabetes.",
  "What diseases mimic Systemic Lupus Erythematosus?",
];

export default function ChatPanel() {
  const {
    isOpen,
    close,
    messages,
    sending,
    error,
    sendMessage,
    startNewSession,
    sessions,
    openSession,
  } = useChat();

  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">Research Assistant</div>
          <div className="text-xs text-gray-500">Answers grounded in the case dataset only</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewSession}
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Prior sessions */}
      {sessions.length > 0 && messages.length === 0 && (
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="mb-1 text-xs font-medium text-gray-400">Recent sessions</div>
          <div className="flex flex-col gap-1">
            {sessions.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className="truncate rounded px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
              >
                {s.title || "Untitled chat"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-teal-300 hover:bg-teal-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>

      <ChatInput onSend={sendMessage} disabled={sending} />
    </div>
  );
}