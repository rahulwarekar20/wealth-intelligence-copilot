"use client";

import { useState, useRef, useEffect } from "react";
import PageLayout from "../components/PageLayout";
import RecommendationCard from "../components/RecommendationCard";
import RetirementCard from "../components/RetirementCard";
import StrategyCard from "../components/StrategyCard";
import { askCopilot, getErrorMessage } from "@/lib/api";
import { useSessionState } from "@/lib/sessionStore";
import {
  comparisonToText,
  recommendationToText,
  retirementToText,
  strategyToText,
  toHistory,
} from "@/lib/chatSession";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { AskResponse } from "@/lib/types";

type Answer = Exclude<AskResponse, { route: "clarify" }>;

interface Message {
  role: "user" | "assistant";
  content: string;
  answer?: Answer;
  pending?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content:
      "Hello! I am your Wealth Intelligence Copilot. Ask me anything about a stock, your whole portfolio, or your retirement plans — just type naturally.",
  },
];

const STARTER_QUESTIONS: { label: string; questions: string[] }[] = [
  {
    label: "Stocks",
    questions: ["Should I buy more Apple?", "Is my MSFT position too large?", "AAPL or GOOGL — which looks stronger?"],
  },
  {
    label: "Portfolio",
    questions: ["How healthy is my whole portfolio?", "What should I rebalance first?"],
  },
  {
    label: "Retirement",
    questions: ["Can I retire at 60 with my current portfolio?", "How much more should I save to retire in 20 years?"],
  },
];

function answerToText(answer: Answer): string {
  switch (answer.route) {
    case "recommendation": return recommendationToText(answer);
    case "comparison": return comparisonToText(answer.results);
    case "strategy": return strategyToText(answer);
    case "retirement": return retirementToText(answer);
  }
}

function AnswerView({ answer }: { answer: Answer }) {
  switch (answer.route) {
    case "recommendation":
      return (
        <div className="w-full space-y-2">
          <RecommendationCard rec={answer} />
          {answer.note && <p className="text-yellow-400 text-xs">{answer.note}</p>}
        </div>
      );
    case "comparison":
      return (
        <div className="w-full space-y-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">
              Comparing {answer.results.map((r) => r.ticker).join(" vs ")}
            </p>
            <p className="text-[15px] leading-relaxed text-gray-100">
              {answer.verdict || "See each stock's analysis below."}
            </p>
          </div>
          <div className={`grid gap-3 ${answer.results.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
            {answer.results.map((r) => (
              <RecommendationCard key={r.ticker} rec={r} compact preferred={answer.preferred === r.ticker} />
            ))}
          </div>
          {answer.note && <p className="text-yellow-400 text-xs">{answer.note}</p>}
          <p className="text-gray-600 text-[11px]">{answer.results[0]?.disclosure}</p>
        </div>
      );
    case "strategy":
      return <StrategyCard strategy={answer} />;
    case "retirement":
      return <RetirementCard result={answer} />;
  }
}

/** Waiting indicator with an elapsed-seconds counter, so a long analysis doesn't look stuck. */
function PendingBubble() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-800 px-4 py-3 text-sm text-gray-300">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-400" />
      </span>
      <span>
        Analysing — reading filings, market data and your portfolio
        <span className="ml-2 tabular-nums text-gray-500">{seconds}s</span>
      </span>
    </div>
  );
}

export default function ChatPage() {
  useRequireAuth();
  const [messages, setMessages, resetMessages] = useSessionState<Message[]>("chat_messages", INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    const query = question.trim();
    if (!query || loading) return;

    // Structured answers are converted to text so the backend keeps the context
    // (e.g. which stock "it" refers to, or the age/income already given)
    const history = toHistory(
      messages.slice(1).filter((m) => !m.pending).map((m) => ({
        role: m.role,
        content: m.answer ? answerToText(m.answer) : m.content,
      })),
      12
    );

    setMessages((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setLoading(true);

    try {
      const data = await askCopilot(query, history);
      const reply: Message =
        data.route === "clarify"
          ? { role: "assistant", content: data.message }
          : { role: "assistant", content: "", answer: data };
      setMessages((prev) => [...prev.filter((m) => !m.pending), reply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.pending),
        { role: "assistant", content: getErrorMessage(err) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const showStarters = messages.length === 1;

  return (
    <PageLayout>
      <div className="flex flex-col h-screen">

        <div className="px-8 py-5 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Copilot Chat</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Stocks · Full portfolio · Retirement planning
            </p>
          </div>
          <button
            onClick={resetMessages}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-500 transition disabled:opacity-50"
          >
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
         <div className="mx-auto w-full max-w-5xl space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.answer ? (
                <AnswerView answer={msg.answer} />
              ) : msg.pending ? (
                <PendingBubble />
              ) : (
                <div className={`px-4 py-3 rounded-2xl whitespace-pre-line text-[15px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white max-w-[75%]"
                    : "bg-gray-800 text-gray-100 max-w-3xl"
                }`}>
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {/* Starter questions on an empty chat */}
          {showStarters && (
            <div className="space-y-4">
              {STARTER_QUESTIONS.map((group) => (
                <div key={group.label}>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.questions.map((q) => (
                      <button
                        key={q}
                        onClick={() => ask(q)}
                        disabled={loading}
                        className="px-3 py-2 bg-gray-900 border border-gray-700 hover:border-teal-500 hover:text-white text-gray-300 text-sm rounded-xl transition disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
         </div>
        </div>

        {/* Input bar */}
        <div className="px-8 py-4 border-t border-gray-800 bg-gray-900">
         <div className="mx-auto w-full max-w-5xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder="e.g. Should I trim my SPY position? · How healthy is my portfolio? · Can I retire at 60?"
              maxLength={2000}
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
              disabled={loading}
            />
            <button
              onClick={() => ask(input)}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm"
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-2">
            Mention a company or ticker for stock analysis — compare up to 3 at once. Informational only, not investment advice.
          </p>
         </div>
        </div>
      </div>
    </PageLayout>
  );
}
