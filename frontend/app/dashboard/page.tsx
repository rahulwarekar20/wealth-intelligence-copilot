"use client";

import { useEffect, useState } from "react";
import { getPortfolioSummary } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageLayout from "../components/PageLayout";

export default function DashboardPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }
    const cached = sessionStorage.getItem("portfolio");
    if (cached) {
      setPortfolio(JSON.parse(cached));
      setLoading(false);
    } else {
      loadPortfolio();
    }
  }, []);

  const loadPortfolio = async () => {
    try {
      const data = await getPortfolioSummary();
      setPortfolio(data);
      sessionStorage.setItem("portfolio", JSON.stringify(data));
    } catch (err) {
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-teal-400 text-xl animate-pulse">Loading portfolio...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="px-8 py-8 max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Portfolio Overview</h1>
          <p className="text-gray-400 mt-1">Your live financial picture</p>
        </div>

        {/* Net Worth Card */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <p className="text-gray-400 text-sm uppercase tracking-wide">Total Portfolio Value</p>
          <p className="text-5xl font-bold text-teal-400 mt-2">
            ${portfolio?.total_value?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-gray-500 text-sm mt-2">{portfolio?.holdings?.length} positions</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Link href="/strategy" className="bg-gray-800 hover:bg-teal-600 rounded-xl p-4 text-center transition">
            <p className="text-2xl mb-1">🧠</p>
            <p className="text-white font-semibold text-sm">Analyse Portfolio</p>
          </Link>
          <Link href="/chat" className="bg-gray-800 hover:bg-teal-600 rounded-xl p-4 text-center transition">
            <p className="text-2xl mb-1">💬</p>
            <p className="text-white font-semibold text-sm">Ask Copilot</p>
          </Link>
          <Link href="/retire" className="bg-gray-800 hover:bg-teal-600 rounded-xl p-4 text-center transition">
            <p className="text-2xl mb-1">🏖️</p>
            <p className="text-white font-semibold text-sm">Retirement Plan</p>
          </Link>
        </div>

        {/* Holdings Table */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Holdings</h2>
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-gray-800">
                <th className="text-left py-2">Ticker</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Value</th>
                <th className="text-right py-2">Weight</th>
              </tr>
            </thead>
            <tbody>
              {portfolio?.holdings?.map((h: any) => (
                <tr key={h.id} className="border-b border-gray-800 hover:bg-gray-800 transition">
                  <td className="py-3 font-bold text-teal-400">{h.ticker}</td>
                  <td className="py-3 text-right text-gray-300">{h.quantity}</td>
                  <td className="py-3 text-right text-gray-300">${h.current_price?.toFixed(2)}</td>
                  <td className="py-3 text-right text-gray-300">
                    ${h.current_value?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      (portfolio?.concentration?.[h.ticker] || 0) > 25
                        ? "bg-red-900 text-red-300"
                        : (portfolio?.concentration?.[h.ticker] || 0) > 15
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-green-900 text-green-300"
                    }`}>
                      {portfolio?.concentration?.[h.ticker]}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Concentration bars */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Concentration</h2>
          <div className="space-y-3">
            {Object.entries(portfolio?.concentration || {}).map(([ticker, pct]: [string, any]) => (
              <div key={ticker}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{ticker}</span>
                  <span className="text-gray-400">{pct}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${pct > 25 ? "bg-red-500" : pct > 15 ? "bg-yellow-500" : "bg-teal-500"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}