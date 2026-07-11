import { create } from "zustand";
import { sendChatMessage } from "@/lib/api/chat";

/**
 * Chat state for the research assistant panel. Not persisted to
 * localStorage on purpose — conversation history lives server-side in
 * chat_sessions/chat_messages (via sessionId), so a refresh just needs to
 * refetch, not replay local state.
 */
export const useChatStore = create((set, get) => ({
  isOpen: false,
  sessionId: null,
  messages: [], // { id, role: 'user'|'assistant', content, evidence?, caseCount?, lowConfidence? }
  sending: false,
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  startNewSession: () => set({ sessionId: null, messages: [], error: null }),

  loadSession: (sessionId, messages) =>
    set({
      sessionId,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        caseCount: null,
        lowConfidence: false,
        retrievedCaseIds: m.retrieved_case_ids || [],
        confidenceScore: m.confidence_score,
      })),
    }),

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = { id: `local-${Date.now()}`, role: "user", content: trimmed };
    set((s) => ({ messages: [...s.messages, userMsg], sending: true, error: null }));

    try {
      const res = await sendChatMessage(trimmed, get().sessionId);
      const assistantMsg = {
        id: `local-${Date.now()}-a`,
        role: "assistant",
        content: res.reply,
        caseCount: res.case_count,
        lowConfidence: res.low_confidence,
        confidenceScore: res.confidence_score,
        evidence: res.evidence || [],
        retrievedCaseIds: res.retrieved_case_ids || [],
      };
      set((s) => ({
        sessionId: res.session_id,
        messages: [...s.messages, assistantMsg],
        sending: false,
      }));
    } catch (err) {
      set({ sending: false, error: err.message || "Something went wrong." });
    }
  },
}));
