"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { listChatSessions, getChatSession } from "@/lib/api/chat";

/**
 * Thin hook on top of useChatStore for components: exposes the store state
 * plus session-list loading, so ChatPanel doesn't need to know about the
 * API layer directly.
 */
export function useChat() {
  const store = useChatStore();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const refreshSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await listChatSessions();
      setSessions(data || []);
    } catch {
      // non-fatal — session history is a nice-to-have, not required to chat
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (store.isOpen) refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen]);

  const openSession = async (sessionId) => {
    const data = await getChatSession(sessionId);
    store.loadSession(data.id, data.messages || []);
  };

  return {
    ...store,
    sessions,
    loadingSessions,
    refreshSessions,
    openSession,
  };
}
