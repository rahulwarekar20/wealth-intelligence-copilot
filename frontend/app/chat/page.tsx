"use client";

/**
 * Ask Copilot ("/chat"): one conversation for stock, portfolio and retirement
 * questions. Conversation state lives in useChat; the pieces of the screen are
 * in components/chat/. A `?ask=` URL parameter pre-fills the question box
 * (used by the "Ask the copilot" links on alerts).
 */
import { useEffect, useRef, useState } from "react";
import ChatInput from "../components/chat/ChatInput";
import MessageBubble from "../components/chat/MessageBubble";
import StarterQuestions from "../components/chat/StarterQuestions";
import PageLayout from "../components/layout/PageLayout";
import { useChat } from "@/lib/useChat";
import { useRequireAuth } from "@/lib/useRequireAuth";

// Same side margins as PageContainer, so the chat lines up with other pages
const GUTTER = "w-full max-w-[1760px] px-4 sm:px-8 xl:px-12";

export default function ChatPage() {
  useRequireAuth();
  const { messages, ask, reset, loading, interrupted } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [suggested, setSuggested] = useState("");

  // Pick up a suggested question from the URL once, then tidy the URL
  useEffect(() => {
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (!ask) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL once on mount
    setSuggested(ask.slice(0, 2000));
    window.history.replaceState(null, "", "/chat");
  }, []);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <PageLayout>
      {/* Fills the screen below the mobile top bar (3.6rem), or the whole screen on desktop */}
      <div className="flex h-[calc(100dvh-3.6rem)] flex-col lg:h-screen">

        {/* Header */}
        <div className="border-b border-paper-300 bg-paper-50/70 backdrop-blur-sm">
          <div className={`${GUTTER} flex items-end justify-between gap-3 py-4 sm:py-6`}>
            <div>
              <p className="eyebrow text-gold-500">Ask Copilot</p>
              <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink-900 sm:text-3xl">
                Ask anything, <span className="italic text-gold-500">get evidence</span>
              </h1>
              <p className="mt-1 text-sm text-ink-600">Stocks · Full portfolio · Retirement planning</p>
            </div>
            <button onClick={reset} disabled={loading} className="btn-secondary px-3.5 py-2 text-sm">
              New chat
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto">
          <div className={`${GUTTER} space-y-6 py-8`}>
            {messages.map((msg, i) => (
              <div key={i} className="space-y-6">
                <MessageBubble
                  message={msg}
                  interrupted={interrupted}
                  // Only the latest message can be retried, and not while another answer is loading
                  onRetry={i === messages.length - 1 && !loading ? (q) => ask(q, true) : undefined}
                />
                {/* Starter questions stay under the greeting for the whole conversation */}
                {i === 0 && <StarterQuestions onAsk={ask} disabled={loading} />}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-paper-300 bg-paper-50/80 backdrop-blur-sm">
          <div className={`${GUTTER} py-5`}>
            <ChatInput key={suggested} onAsk={ask} loading={loading} initialValue={suggested} />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
