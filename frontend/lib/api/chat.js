import { apiFetch } from "@/lib/api/client";

/** Send a message to the research assistant. Omit sessionId to start a new session. */
export function sendChatMessage(message, sessionId) {
  return apiFetch("/chat", {
    method: "POST",
    body: { message, session_id: sessionId || undefined },
  });
}

export function listChatSessions() {
  return apiFetch("/chat/sessions");
}

export function getChatSession(sessionId) {
  return apiFetch(`/chat/sessions/${sessionId}`);
}
