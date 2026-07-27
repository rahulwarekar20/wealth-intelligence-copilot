"use client";

import { useState, useRef, useEffect } from "react";
import { submitDecision } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  recommendation?: any;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your Wealth Intelligence Copilot. Ask me about any investment decision — for example: 'Should I buy more AAPL?' or 'Is SPY too concentrated in my portfolio?'",
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

    // Show thinking message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "🤔 Running 5-agent analysis... Supervisor → Portfolio → Evidence → Market Data → Composer",
      },
    ]);

    try {
      const data = await submitDecision(input, ticker);

      // Replace thinking message with real response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "", recommendation: data },
      ]);
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
      case "buy": return "bg-green-900 text-green-300 border-green-700";
      case "sell": return "bg-red-900 text-red-300 border-red-700";
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

      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-teal-400">
          Wealth Intelligence Copilot
        </h1>
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="text-gray-300 hover:text-teal-400 transition">
            Dashboard
          </Link>
          <Link href="/journal" className="text-gray-300 hover:text-teal-400 transition">
            Journal
          </Link>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-6 ${msg.role === "user" ? "text-right" : "text-left"}`}>

            {/* Simple text message */}
            {msg.content && !msg.recommendation && (
              <div className={`inline-block px-4 py-3 rounded-2xl max-w-2xl ${
                msg.role === "user"
                  ? "bg-teal-600 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}>
                {msg.content}
              </div>
            )}

            {/* Recommendation card */}
            {msg.recommendation && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl">

                {/* Action + Confidence */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-4 py-2 rounded-lg border font-bold text-lg uppercase ${getActionColor(msg.recommendation.action)}`}>
                    {msg.recommendation.action}
                  </span>
                  <span className={`font-semibold ${getConfidenceColor(msg.recommendation.confidence)}`}>
                    {Math.round(msg.recommendation.confidence * 100)}% confidence
                  </span>
                  {msg.recommendation.disagreement_flag && (
                    <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded border border-orange-700">
                      ⚠️ Agents disagree
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p className="text-gray-200 mb-4 leading-relaxed">
                  {msg.recommendation.summary}
                </p>

                {/* Evidence For */}
                {msg.recommendation.evidence_for?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-green-400 text-sm font-semibold mb-2">
                      ✅ Evidence For
                    </p>
                    {msg.recommendation.evidence_for.map((e: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-gray-500 text-xs mt-1">
                          [{e.agent?.replace("_agent", "")}]
                        </span>
                        <p className="text-gray-300 text-sm">{e.point}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Evidence Against */}
                {msg.recommendation.evidence_against?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-red-400 text-sm font-semibold mb-2">
                      ❌ Evidence Against
                    </p>
                    {msg.recommendation.evidence_against.map((e: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-gray-500 text-xs mt-1">
                          [{e.agent?.replace("_agent", "")}]
                        </span>
                        <p className="text-gray-300 text-sm">{e.point}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disagreement note */}
                {msg.recommendation.disagreement_note && (
                  <div className="mb-3 p-3 bg-orange-950 border border-orange-800 rounded-lg">
                    <p className="text-orange-300 text-sm">
                      ⚠️ {msg.recommendation.disagreement_note}
                    </p>
                  </div>
                )}

                {/* Attribution */}
                <div className="mb-3">
                  <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">
                    Agent Attribution
                  </p>
                  {Object.entries(msg.recommendation.attribution || {}).map(
                    ([agent, contribution]: [string, any]) => (
                      <div key={agent} className="flex gap-2 mb-1">
                        <span className="text-teal-400 text-xs font-mono min-w-32">
                          {agent.replace("_agent", "")}:
                        </span>
                        <p className="text-gray-400 text-xs">{contribution}</p>
                      </div>
                    )
                  )}
                </div>

                {/* Diversity score */}
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-gray-500 text-xs">Evidence diversity:</p>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-teal-500"
                      style={{ width: `${(msg.recommendation.evidence_diversity_score || 0) * 100}%` }}
                    />
                  </div>
                  <p className="text-gray-400 text-xs">
                    {Math.round((msg.recommendation.evidence_diversity_score || 0) * 100)}%
                  </p>
                </div>

                {/* Disclosure */}
                <p className="text-gray-600 text-xs border-t border-gray-800 pt-3">
                  {msg.recommendation.disclosure}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ticker (e.g. AAPL)"
            className="w-28 px-3 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-teal-400 text-sm uppercase"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask about an investment decision..."
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
          Enter a ticker and your question — the 5-agent system will analyze and respond
        </p>
      </div>

    </main>
  );
}