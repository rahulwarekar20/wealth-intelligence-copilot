"use client";

import { useState, useRef, useEffect } from "react";
import { submitDecision } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      content: "Hello! I am your Wealth Intelligence Copilot. I can help in two ways:\n\n1. Single stock: Enter a ticker (e.g. AAPL) and ask 'Should I buy more AAPL?'\n\n2. Full portfolio: Type ALL in the ticker box and ask 'What should I do with my portfolio?' to get a strategy for every position.",
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

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const isPortfolioWide = ticker.trim() === "ALL";

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: isPortfolioWide
          ? "Running full portfolio strategy analysis across all positions..."
          : "Running 5-agent analysis... Supervisor then Portfolio then Evidence then Market Data then Composer",
      },
    ]);

    try {
      if (isPortfolioWide) {
        const token = localStorage.getItem("token");
        const response = await fetch(
          "http://localhost:8000/decisions/portfolio-strategy",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "", strategy: data },
        ]);
      } else {
        const data = await submitDecision(input, ticker);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "", recommendation: data },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "buy":
      case "buy more": return "bg-green-900 text-green-300 border-green-700";
      case "sell":
      case "trim": return "bg-red-900 text-red-300 border-red-700";
      case "hold": return "bg-yellow-900 text-yellow-300 border-yellow-700";
      case "rebalance": return "bg-blue-900 text-blue-300 border-blue-700";
      default: return "bg-gray-800 text-gray-300 border-gray-700";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-400";
    if (confidence >= 0.4) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">

      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-teal-400">Wealth Intelligence Copilot</h1>
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="text-gray-300 hover:text-teal-400 transition">Dashboard</Link>
          <Link href="/strategy" className="text-gray-300 hover:text-teal-400 transition">Strategy</Link>
          <Link href="/journal" className="text-gray-300 hover:text-teal-400 transition">Journal</Link>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-6 ${msg.role === "user" ? "text-right" : "text-left"}`}>

            {msg.content && !msg.recommendation && !msg.strategy && (
              <div className={`inline-block px-4 py-3 rounded-2xl max-w-2xl whitespace-pre-line ${
                msg.role === "user" ? "bg-teal-600 text-white" : "bg-gray-800 text-gray-200"
              }`}>
                {msg.content}
              </div>
            )}

            {msg.strategy && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-teal-400 font-bold text-lg">Portfolio Strategy</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                    (msg.strategy.portfolio_health?.overall_score || 0) >= 70
                      ? "bg-green-900 text-green-300"
                      : (msg.strategy.portfolio_health?.overall_score || 0) >= 50
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-red-900 text-red-300"
                  }`}>
                    Health: {msg.strategy.portfolio_health?.overall_score}/100
                  </span>
                </div>
                <p className="text-gray-200 mb-4">{msg.strategy.portfolio_health?.summary}</p>
                <div className="space-y-2 mb-4">
                  {msg.strategy.positions?.map((pos: any) => (
                    <div key={pos.ticker} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                      <span className="text-teal-400 font-bold w-14">{pos.ticker}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getActionColor(pos.action)}`}>
                        {pos.action}
                      </span>
                      <span className="text-gray-400 text-xs">{pos.weight_pct}% weight</span>
                      <p className="text-gray-300 text-xs flex-1">
                        {pos.reasoning?.substring(0, 80)}...
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <p className="text-gray-400 text-xs font-semibold mb-2">Priority Actions</p>
                  {msg.strategy.priority_actions?.slice(0, 3).map((action: any) => (
                    <p key={action.rank} className="text-gray-300 text-xs mb-1">
                      {action.rank}. <span className="text-teal-400">{action.ticker}</span> — {action.action} ({action.urgency} urgency): {action.reason}
                    </p>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-3 border-t border-gray-800 pt-2">
                  For full detail view go to the Strategy page
                </p>
              </div>
            )}

            {msg.recommendation && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-4 py-2 rounded-lg border font-bold text-lg uppercase ${getActionColor(msg.recommendation.action)}`}>
                    {msg.recommendation.action}
                  </span>
                  <span className={`font-semibold ${getConfidenceColor(msg.recommendation.confidence)}`}>
                    {Math.round(msg.recommendation.confidence * 100)}% confidence
                  </span>
                  {msg.recommendation.disagreement_flag && (
                    <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded border border-orange-700">
                      Agents disagree
                    </span>
                  )}
                </div>
                <p className="text-gray-200 mb-4 leading-relaxed">{msg.recommendation.summary}</p>
                {msg.recommendation.evidence_for?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-green-400 text-sm font-semibold mb-2">Evidence For</p>
                    {msg.recommendation.evidence_for.map((e: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-gray-500 text-xs mt-1">[{e.agent?.replace("_agent", "")}]</span>
                        <p className="text-gray-300 text-sm">{e.point}</p>
                      </div>
                    ))}
                  </div>
                )}
                {msg.recommendation.evidence_against?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-red-400 text-sm font-semibold mb-2">Evidence Against</p>
                    {msg.recommendation.evidence_against.map((e: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-gray-500 text-xs mt-1">[{e.agent?.replace("_agent", "")}]</span>
                        <p className="text-gray-300 text-sm">{e.point}</p>
                      </div>
                    ))}
                  </div>
                )}
                {msg.recommendation.disagreement_note && (
                  <div className="mb-3 p-3 bg-orange-950 border border-orange-800 rounded-lg">
                    <p className="text-orange-300 text-sm">{msg.recommendation.disagreement_note}</p>
                  </div>
                )}
                <div className="mb-3">
                  <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Agent Attribution</p>
                  {Object.entries(msg.recommendation.attribution || {}).map(([agent, contribution]: [string, any]) => (
                    <div key={agent} className="flex gap-2 mb-1">
                      <span className="text-teal-400 text-xs font-mono min-w-32">{agent.replace("_agent", "")}:</span>
                      <p className="text-gray-400 text-xs">{contribution}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-gray-500 text-xs">Evidence diversity:</p>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-teal-500"
                      style={{ width: `${(msg.recommendation.evidence_diversity_score || 0) * 100}%` }}
                    />
                  </div>
                  <p className="text-gray-400 text-xs">{Math.round((msg.recommendation.evidence_diversity_score || 0) * 100)}%</p>
                </div>
                <p className="text-gray-600 text-xs border-t border-gray-800 pt-3">{msg.recommendation.disclosure}</p>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
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
            placeholder="Ask about a stock or your whole portfolio..."
            className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-teal-400"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim() || !ticker.trim()}
            className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {loading ? "..." : "Ask"}
          </button>
        </div>
        <p className="text-gray-600 text-xs text-center mt-2">
          Single stock: enter ticker + question &nbsp;|&nbsp; Full portfolio: type ALL + your question
        </p>
      </div>

    </main>
  );
}