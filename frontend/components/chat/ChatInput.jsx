"use client";

import { useState } from "react";

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 p-3">
      <textarea
        className="max-h-28 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
        rows={1}
        placeholder="Ask about symptoms, countries, outcomes, differentials..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {disabled ? "..." : "Send"}
      </button>
    </div>
  );
}
