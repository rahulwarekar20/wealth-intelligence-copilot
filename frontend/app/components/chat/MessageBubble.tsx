"use client";

/**
 * One chat message: the user's question (dark bubble, right), a plain-text
 * reply (light card, left), a structured answer card, or the waiting indicator.
 * Failed and interrupted answers get a "Try again" button.
 */
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/useChat";
import AnswerView from "./AnswerView";

/** Waiting indicator with an elapsed-seconds counter, so a long analysis doesn't look stuck. */
function PendingBubble() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="card flex items-center gap-3 px-4 py-3 text-sm text-ink-700">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400" />
      </span>
      <span>
        Analysing — reading filings, market data and your portfolio
        <span className="ml-2 tabular-nums text-ink-500">{seconds}s</span>
      </span>
    </div>
  );
}

/** "Try again" button under a failed or interrupted answer. */
function RetryButton({ question, onRetry }: { question: string; onRetry?: (question: string) => void }) {
  if (!onRetry) return null;
  return (
    <button onClick={() => onRetry(question)} className="btn-secondary mt-3 px-3.5 py-1.5 text-sm">
      Try again
    </button>
  );
}

export default function MessageBubble({
  message,
  interrupted,
  onRetry,
}: {
  message: ChatMessage;
  interrupted: boolean;
  onRetry?: (question: string) => void;
}) {
  const isUser = message.role === "user";

  let body: React.ReactNode;
  if (message.answer) {
    body = <AnswerView answer={message.answer} />;
  } else if (message.pending && !interrupted) {
    body = <PendingBubble />;
  } else if (message.pending) {
    body = (
      <div className="card max-w-3xl px-5 py-3.5 text-[15px] text-ink-700">
        This question was interrupted because the page reloaded.
        {message.retry && <div><RetryButton question={message.retry} onRetry={onRetry} /></div>}
      </div>
    );
  } else {
    body = (
      <div
        className={`whitespace-pre-line rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed ${
          isUser ? "max-w-[75%] bg-ink-900 text-paper-50 shadow-card" : "card max-w-3xl text-ink-800"
        }`}
      >
        {message.content}
        {message.retry && <div><RetryButton question={message.retry} onRetry={onRetry} /></div>}
      </div>
    );
  }

  return <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>{body}</div>;
}
