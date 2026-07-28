"use client";

import { useEffect, useState } from "react";
import { getPortfolioSummary } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      const data = await getPortfolioSummary();
      setPortfolio(data);
    } catch (err) {
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-teal-400 text-xl animate-pulse">
          Loading portfolio...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-teal-400">
          Wealth Intelligence Copilot
        </h1>
        <div className="flex gap-4 items-center">
         <Link href="/strategy" className="text-gray-300 hover:text-teal-400 transition">
            Strategy
         </Link>
         <Link href="/chat" className="text-gray-300 hover:text-teal-400 transition">
           Chat
         </Link>
          <Link href="/journal" className="text-gray-300 hover:text-teal-400 transition">
            Journal
           </Link>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-400 transition text-sm"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Net Worth Card */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <p className="text-gray-400 text-sm">Total Portfolio Value</p>
          <p className="text-4xl font-bold text-teal-400 mt-1">
            ${portfolio?.total_value?.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {portfolio?.holdings?.length} positions
          </p>
        </div>

        {/* Holdings Table */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Holdings</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-800">
                  <th className="text-left py-2">Ticker</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Value</th>
                  <th className="text-right py-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {portfolio?.holdings?.map((h: any) => (
                  <tr key={h.id} className="border-b border-gray-800 hover:bg-gray-800 transition">
                    <td className="py-3 font-semibold text-teal-400">
                      {h.ticker}
                    </td>
                    <td className="py-3 text-right text-gray-300">
                      {h.quantity}
                    </td>
                    <td className="py-3 text-right text-gray-300">
                      ${h.current_price?.toFixed(2)}
                    </td>
                    <td className="py-3 text-right text-gray-300">
                      ${h.current_value?.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
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
        </div>

        {/* Concentration Summary */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            Concentration Analysis
          </h2>
          <div className="space-y-3">
            {Object.entries(portfolio?.concentration || {}).map(
              ([ticker, pct]: [string, any]) => (
                <div key={ticker}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{ticker}</span>
                    <span className="text-gray-400">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        pct > 25
                          ? "bg-red-500"
                          : pct > 15
                          ? "bg-yellow-500"
                          : "bg-teal-500"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            )}
          </div>
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-xs">
              🔴 Red = High concentration (&gt;25%) &nbsp;
              🟡 Yellow = Medium (15-25%) &nbsp;
              🟢 Green = Low (&lt;15%)
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/chat"
            className="inline-block px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition text-lg"
          >
            Ask the AI Copilot →
          </Link>
        </div>

      </div>
    </main>
  );
}