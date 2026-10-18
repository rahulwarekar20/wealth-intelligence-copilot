"use client";

/**
 * Question box pinned to the bottom of the chat. Enter or "Ask" sends the
 * question and clears the box. `initialValue` pre-fills it (e.g. a question
 * suggested by an alert) without sending it.
 */
import { useState } from "react";

export default function ChatInput({
  onAsk,
  loading,
  initialValue = "",
}: {
  onAsk: (question: string) => void;
  loading: boolean;
  initialValue?: string;
}) {
  const [input, setInput] = useState(initialValue);

  const send = () => {
    if (!input.trim() || loading) return;
    onAsk(input);
    setInput("");
  };

  return (
    <div>
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e.g. Should I trim my SPY position? · How healthy is my portfolio? · Can I retire at 60?"
          maxLength={2000}
          className="field flex-1 rounded-xl px-4 py-3 text-sm shadow-card"
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()} className="btn-primary rounded-xl px-6 py-3 text-sm">
          {loading ? "..." : "Ask"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-400">
        Mention a company or ticker for stock analysis — compare up to 3 at once. Informational only, not investment advice.
      </p>
    </div>
  );
}
