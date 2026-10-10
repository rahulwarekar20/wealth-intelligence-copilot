"use client";

import { useState, useRef, useEffect } from "react";
import { submitDecision } from "@/lib/api";
import { useRouter } from "next/navigation";
import PageLayout from "../components/PageLayout";

interface Message {
  role: "user" | "assistant";
  content: string;
  recommendation?: any;
  strategy?: any;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your Wealth Intelligence Copilot.\n\nSingle stock: Enter a ticker (e.g. AAPL) and ask your question.\n\nFull portfolio: Type ALL in the ticker box to get a strategy across every position.",
    },
  ]);
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || !ticker.trim() || loading) return;
    const userMessage: Message = { role: "user", content: `[${ticker}] ${input}` };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    const isPortfolioWide = ticker.trim() === "ALL";
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: isPortfolioWide
        ? "Running full portfolio strategy analysis..."
        : "Running 5-agent analysis...",
    }]);
    try {
      if (isPortfolioWide) {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:8000/decisions/portfolio-strategy", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "", strategy: data }]);
      } else {
        const data = await submitDecision(input, ticker);
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "", recommendation: data }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "buy": case "buy more": return "bg-green-900 text-green-300 border-green-700";
      case "sell": case "trim": return "bg-red-900 text-red-300 border-red-700";
      case "hold": return "bg-yellow-900 text-yellow-300 border-yellow-700";
      default: return "bg-gray-800 text-gray-300 border-gray-700";
    }
  };

  return (
    <PageLayout>
      <div className="flex flex-col h-screen">

        <div className="px-8 py-5 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white">AI Copilot Chat</h1>
          <p className="text-gray-400 text-sm mt-0.5">Ask about any stock or your full portfolio</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

              {msg.content && !msg.recommendation && !msg.strategy && (
                <div className={`px-4 py-3 rounded-2xl max-w-2xl whitespace-pre-line text-sm ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white"
                    : "bg-gray-800 text-gray-200"
                }`}>
                  {msg.content}
                </div>
              )}

              {msg.strategy && (
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-2xl w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-teal-400 font-bold">Portfolio Strategy</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      (msg.strategy.portfolio_health?.overall_score || 0) >= 70
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}>
                      Health: {msg.strategy.portfolio_health?.overall_score}/100
                    </span>
                  </div>
                  <p className="text-gray-200 text-sm mb-3">{msg.strategy.portfolio_health?.summary}</p>
                  <div className="space-y-2">
                    {msg.strategy.positions?.map((pos: any) => (
                      <div key={pos.ticker} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                        <span className="text-teal-400 font-bold w-14">{pos.ticker}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getActionColor(pos.action)}`}>{pos.action}</span>
                        <p className="text-gray-300 text-xs flex-1">{pos.reasoning?.substring(0, 80)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {msg.recommendation && (
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-2xl w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1.5 rounded-lg border font-bold uppercase text-sm ${getActionColor(msg.recommendation.action)}`}>
                      {msg.recommendation.action}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {Math.round(msg.recommendation.confidence * 100)}% confidence
                    </span>
                    {msg.recommendation.disagreement_flag && (
                      <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded">Agents disagree</span>
                    )}
                  </div>
                  <p className="text-gray-200 text-sm mb-3">{msg.recommendation.summary}</p>
                  {msg.recommendation.evidence_for?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-green-400 text-xs font-semibold mb-1">Evidence For</p>
                      {msg.recommendation.evidence_for.map((e: any, i: number) => (
                        <p key={i} className="text-gray-300 text-xs mb-0.5">• [{e.agent?.replace("_agent", "")}] {e.point}</p>
                      ))}
                    </div>
                  )}
                  {msg.recommendation.evidence_against?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-red-400 text-xs font-semibold mb-1">Evidence Against</p>
                      {msg.recommendation.evidence_against.map((e: any, i: number) => (
                        <p key={i} className="text-gray-300 text-xs mb-0.5">• [{e.agent?.replace("_agent", "")}] {e.point}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-gray-600 text-xs border-t border-gray-800 pt-2 mt-2">{msg.recommendation.disclosure}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-8 py-4 border-t border-gray-800 bg-gray-900">
          <div className="flex gap-3">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Ticker or ALL"
              className="w-32 px-3 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-teal-400 text-sm uppercase"
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Ask about a stock or your portfolio..."
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim() || !ticker.trim()}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm"
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-2">
            Single stock: ticker + question &nbsp;|&nbsp; Full portfolio: type ALL
          </p>
        </div>
      </div>
    </PageLayout>
  );
}