"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import PageLayout from "../components/PageLayout";

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/");
    const cached = sessionStorage.getItem("strategy");
    if (cached) setStrategy(JSON.parse(cached));
  }, []);

  const runStrategy = async () => {
    setLoading(true);
    setError("");
    setStrategy(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "http://localhost:8000/decisions/portfolio-strategy",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStrategy(response.data);
      sessionStorage.setItem("strategy", JSON.stringify(response.data));
    } catch (err) {
      setError("Failed to run strategy analysis. Please try again.");
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

  const getConcentrationColor = (flag: string) => {
    switch (flag?.toUpperCase()) {
      case "HIGH": return "text-red-400";
      case "MEDIUM": return "text-yellow-400";
      default: return "text-green-400";
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <PageLayout>
      <div className="px-8 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Portfolio Strategy</h1>
          <p className="text-gray-400 mt-1">AI analysis across all your positions simultaneously</p>
        </div>

        {!strategy && !loading && (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
            <p className="text-4xl mb-4">🧠</p>
            <p className="text-white text-xl font-semibold mb-2">Ready to analyse your portfolio?</p>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              The AI evaluates every position using live prices, news sentiment, and fundamentals — then gives you a prioritised action plan.
            </p>
            <button onClick={runStrategy} className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition text-lg">
              Analyse My Portfolio
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
            <div className="animate-pulse space-y-3">
              <p className="text-teal-400 text-xl font-semibold">Analysing all positions...</p>
              <p className="text-gray-400 text-sm">Fetching live prices and evidence for each ticker</p>
              <p className="text-gray-400 text-sm">Composing portfolio-wide strategy</p>
              <p className="text-gray-600 text-xs mt-4">Takes 30-60 seconds</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-300">{error}</p>
            <button onClick={runStrategy} className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm transition">Try Again</button>
          </div>
        )}

        {strategy && (
          <div className="space-y-6">

            {/* Health Card */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Portfolio Health</h2>
                <button onClick={runStrategy} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">Refresh</button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-xs mb-1">Health Score</p>
                  <p className={`text-3xl font-bold ${getHealthColor(strategy.portfolio_health?.overall_score || 0)}`}>
                    {strategy.portfolio_health?.overall_score || 0}<span className="text-lg">/100</span>
                  </p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-xs mb-1">Diversification</p>
                  <p className="text-xl font-bold text-white capitalize">{strategy.portfolio_health?.diversification || "N/A"}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-gray-400 text-xs mb-1">Total Value</p>
                  <p className="text-xl font-bold text-teal-400">
                    ${strategy.total_value?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <p className="text-gray-200 mb-3">{strategy.portfolio_health?.summary}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-950 border border-red-900 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-semibold mb-1">Top Risk</p>
                  <p className="text-gray-300 text-sm">{strategy.portfolio_health?.top_risk}</p>
                </div>
                <div className="bg-green-950 border border-green-900 rounded-lg p-3">
                  <p className="text-green-400 text-xs font-semibold mb-1">Top Opportunity</p>
                  <p className="text-gray-300 text-sm">{strategy.portfolio_health?.top_opportunity}</p>
                </div>
              </div>
            </div>

            {/* Priority Actions */}
            {strategy.priority_actions?.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h2 className="text-lg font-bold text-white mb-4">Priority Actions</h2>
                <div className="space-y-3">
                  {strategy.priority_actions.map((action: any) => (
                    <div key={action.rank} className="flex items-center gap-4 bg-gray-800 rounded-xl p-4">
                      <span className="text-gray-500 font-bold w-6">{action.rank}</span>
                      <span className="text-teal-400 font-bold w-16">{action.ticker}</span>
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase border ${getActionColor(action.action)}`}>{action.action}</span>
                      <p className="text-gray-300 text-sm flex-1">{action.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positions */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-white mb-4">Position-by-Position Strategy</h2>
              <div className="space-y-4">
                {strategy.positions?.map((pos: any) => (
                  <div key={pos.ticker} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-teal-400 font-bold text-xl">{pos.ticker}</span>
                        <span className={`px-3 py-1 rounded-lg border text-sm font-bold uppercase ${getActionColor(pos.action)}`}>{pos.action}</span>
                        <span className={`text-sm font-semibold ${getConcentrationColor(pos.concentration_flag)}`}>{pos.concentration_flag} concentration</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">${pos.current_price?.toFixed(2)}</p>
                        <p className={`text-sm ${(pos.gain_loss_pct || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(pos.gain_loss_pct || 0) >= 0 ? "+" : ""}{pos.gain_loss_pct?.toFixed(2)}% vs cost
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-200 text-sm mb-3">{pos.reasoning}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {pos.key_risk && (
                        <div className="bg-red-950 border border-red-900 rounded-lg p-2">
                          <p className="text-red-400 text-xs font-semibold">Risk</p>
                          <p className="text-gray-300 text-xs">{pos.key_risk}</p>
                        </div>
                      )}
                      {pos.key_opportunity && (
                        <div className="bg-green-950 border border-green-900 rounded-lg p-2">
                          <p className="text-green-400 text-xs font-semibold">Opportunity</p>
                          <p className="text-gray-300 text-xs">{pos.key_opportunity}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-gray-600 text-xs text-center pb-4">
              Informational only. Not personalized investment advice. Consult a qualified financial advisor before making investment decisions.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}