"use client";

import { useChatStore } from "@/store/useChatStore";

/**
 * Floating action button that opens the ChatPanel. Mount this once in the
 * dashboard layout (app/(dashboard)/layout.jsx) so it's available on every
 * authenticated page.
 */
export default function ChatButton() {
  const { isOpen, toggle } = useChatStore();

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition hover:bg-teal-700"
      aria-label="Open research assistant"
    >
      {isOpen ? (
        <span className="text-xl leading-none">&#10005;</span>
      ) : (
        <span className="text-xl leading-none">&#128172;</span>
      )}
    </button>
  );
}
