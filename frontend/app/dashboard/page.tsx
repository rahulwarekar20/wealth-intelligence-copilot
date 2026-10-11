"use client";

import { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import {
  addHolding,
  deleteHolding,
  getErrorMessage,
  getPortfolioStrategy,
  getPortfolioSummary,
} from "@/lib/api";
import { useSessionState } from "@/lib/sessionStore";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { actionColor, formatMoney, healthColor } from "@/lib/ui";
import type { PortfolioStrategy, PortfolioSummary } from "@/lib/types";

const NO_STRATEGY: PortfolioStrategy | null = null;
const EMPTY_FORM = { ticker: "", quantity: "", cost_basis: "", account_type: "taxable" };

export default function DashboardPage() {
  useRequireAuth();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Strategy is cached for the session, but cleared whenever holdings change
  const [strategy, setStrategy, clearStrategy] = useSessionState("strategy", NO_STRATEGY);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await getPortfolioSummary();
      setPortfolio(data);
      setLoadError("");
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not load your portfolio."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch fresh portfolio data (prices are cached server-side for 5 minutes)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the request resolves
    loadPortfolio();
  }, [loadPortfolio]);

  const runStrategy = async () => {
    setStrategyLoading(true);
    setStrategyError("");
    try {
      const data = await getPortfolioStrategy();
      if (data.no_holdings) {
        clearStrategy();
        setStrategyError("Add some holdings first.");
      } else {
        setStrategy(data);
      }
    } catch (err) {
      setStrategyError(getErrorMessage(err, "Analysis failed. Please try again."));
    } finally {
      setStrategyLoading(false);
    }
  };

  const handleAdd = async () => {
    const quantity = Number(form.quantity);
    const costBasis = form.cost_basis.trim() === "" ? null : Number(form.cost_basis);
    if (!form.ticker.trim()) return setFormError("Enter a ticker.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setFormError("Quantity must be greater than 0.");
    if (costBasis !== null && (!Number.isFinite(costBasis) || costBasis < 0)) {
      return setFormError("Cost basis must be 0 or more.");
    }

    setSaving(true);
    setFormError("");
    try {
      await addHolding({
        ticker: form.ticker.trim().toUpperCase(),
        quantity,
        cost_basis: costBasis,
        account_type: form.account_type,
      });
      setForm(EMPTY_FORM);
      clearStrategy();
      await loadPortfolio();
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not add holding."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, ticker: string) => {
    if (!window.confirm(`Remove ${ticker} from your portfolio?`)) return;
    try {
      await deleteHolding(id);
      clearStrategy();
      await loadPortfolio();
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not remove holding."));
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

  const concentrationClass = (pct: number) =>
    pct > 25 ? "bg-red-900 text-red-300" : pct > 15 ? "bg-yellow-900 text-yellow-300" : "bg-green-900 text-green-300";

  return (
    <PageLayout>
      <div className="px-8 py-6 flex flex-col h-screen">

        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">Portfolio overview and AI strategy in one view</p>
        </div>

        {loadError && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">{loadError}</div>
        )}

        <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">

          {/* LEFT — Portfolio Overview */}
          <div className="overflow-y-auto space-y-4 pr-2">

            {/* Net Worth */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Portfolio Value</p>
              <p className="text-4xl font-bold text-teal-400">{formatMoney(portfolio?.total_value ?? 0)}</p>
              <p className="text-gray-500 text-sm mt-1">{portfolio?.holdings?.length ?? 0} positions</p>
              {(portfolio?.unpriced_tickers?.length ?? 0) > 0 && (
                <p className="text-yellow-400 text-xs mt-2">
                  Live prices unavailable for {portfolio!.unpriced_tickers.join(", ")} — excluded from the total.
                </p>
              )}
            </div>

            {/* Holdings */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wide mb-3">Holdings</h2>
              {portfolio?.holdings?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left py-1.5">Ticker</th>
                      <th className="text-right py-1.5">Qty</th>
                      <th className="text-right py-1.5">Price</th>
                      <th className="text-right py-1.5">Value</th>
                      <th className="text-right py-1.5">Weight</th>
                      <th className="py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((h) => (
                      <tr key={h.id} className="border-b border-gray-800 hover:bg-gray-800 transition">
                        <td className="py-2 font-bold text-teal-400">
                          {h.ticker}
                          {h.account_type !== "taxable" && (
                            <span className="ml-1 text-gray-500 text-xs font-normal">{h.account_type}</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-gray-300">{h.quantity}</td>
                        <td className="py-2 text-right text-gray-300">{formatMoney(h.current_price)}</td>
                        <td className="py-2 text-right text-gray-300">{formatMoney(h.current_value, 0)}</td>
                        <td className="py-2 text-right">
                          {h.weight_pct === null ? (
                            <span className="text-gray-500 text-xs">n/a</span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${concentrationClass(h.weight_pct)}`}>
                              {h.weight_pct}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => handleDelete(h.id, h.ticker)}
                            className="text-gray-500 hover:text-red-400 text-xs transition"
                            aria-label={`Remove ${h.ticker}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-sm">No holdings yet — add your first position below.</p>
              )}

              {/* Add holding */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add holding</p>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    value={form.ticker}
                    onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                    placeholder="Ticker"
                    maxLength={10}
                    className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400 text-sm uppercase"
                  />
                  <input
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="Quantity"
                    inputMode="decimal"
                    className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
                  />
                  <input
                    value={form.cost_basis}
                    onChange={(e) => setForm({ ...form, cost_basis: e.target.value })}
                    placeholder="Cost / share"
                    inputMode="decimal"
                    className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
                  />
                  <select
                    value={form.account_type}
                    onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                    className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-teal-400 text-sm"
                  >
                    <option value="taxable">Taxable</option>
                    <option value="ira">IRA</option>
                    <option value="roth_ira">Roth IRA</option>
                    <option value="401k">401(k)</option>
                  </select>
                </div>
                {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="mt-2 w-full py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add holding"}
                </button>
              </div>
            </div>

            {/* Concentration bars */}
            {Object.keys(portfolio?.concentration || {}).length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wide mb-3">Concentration Risk</h2>
                <div className="space-y-2.5">
                  {Object.entries(portfolio?.concentration || {}).map(([ticker, pct]) => (
                    <div key={ticker}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{ticker}</span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            pct > 25 ? "bg-red-500" : pct > 15 ? "bg-yellow-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> High (&gt;25%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span> Medium (15-25%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span> Low (&lt;15%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — AI Portfolio Strategy */}
          <div className="overflow-y-auto space-y-4 pr-2">

            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-teal-400 uppercase tracking-wide">
                    AI Portfolio Strategy
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Buy / Hold / Sell across all positions</p>
                </div>
                <button
                  onClick={runStrategy}
                  disabled={strategyLoading || !portfolio?.holdings?.length}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {strategyLoading ? "Analysing..." : strategy ? "Refresh" : "Analyse Portfolio"}
                </button>
              </div>

              {!strategy && !strategyLoading && !strategyError && (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">🧠</p>
                  <p className="text-gray-400 text-sm">
                    Click Analyse Portfolio to get AI recommendations across all your positions
                  </p>
                </div>
              )}

              {strategyLoading && (
                <div className="text-center py-10 animate-pulse space-y-2">
                  <p className="text-teal-400 text-sm">Running portfolio analysis...</p>
                  <p className="text-gray-500 text-xs">Fetching live data and running agents</p>
                  <p className="text-gray-600 text-xs">Takes 30-60 seconds</p>
                </div>
              )}

              {strategyError && (
                <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                  {strategyError}
                </div>
              )}

              {strategy && !strategyLoading && (
                <div className="space-y-4">

                  {/* Health scores */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Health Score</p>
                      <p className={`text-2xl font-bold ${healthColor(strategy.portfolio_health?.overall_score || 0)}`}>
                        {strategy.portfolio_health?.overall_score || 0}
                        <span className="text-sm">/100</span>
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Diversification</p>
                      <p className="text-base font-bold text-white capitalize">
                        {strategy.portfolio_health?.diversification || "N/A"}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Positions</p>
                      <p className="text-base font-bold text-white">{strategy.position_count}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-gray-300 text-sm">{strategy.portfolio_health?.summary}</p>

                  {/* Per position */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Position Recommendations
                    </p>
                    {strategy.positions?.map((pos) => (
                      <div key={pos.ticker} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                        <span className="text-teal-400 font-bold w-12 text-sm">{pos.ticker}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${actionColor(pos.action)}`}>
                          {pos.action}
                        </span>
                        <span className="text-gray-400 text-xs w-16">
                          {pos.weight_pct === null || pos.weight_pct === undefined ? "n/a" : `${pos.weight_pct}% weight`}
                        </span>
                        <p className="text-gray-300 text-xs flex-1 line-clamp-2">{pos.reasoning}</p>
                      </div>
                    ))}
                  </div>

                  {/* Priority actions */}
                  {strategy.priority_actions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Priority Actions
                      </p>
                      {strategy.priority_actions.slice(0, 3).map((a) => (
                        <div key={`${a.rank}-${a.ticker}`} className="flex items-center gap-2 text-xs text-gray-300 mb-1.5">
                          <span className="text-gray-500 w-4">{a.rank}.</span>
                          <span className="text-teal-400 font-bold w-12">{a.ticker}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase border ${actionColor(a.action)}`}>
                            {a.action}
                          </span>
                          <span className="flex-1 text-gray-400">{a.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Risk + Opportunity */}
            {strategy && !strategyLoading && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-950 border border-red-900 rounded-xl p-4">
                  <p className="text-red-400 text-xs font-semibold mb-1">Top Risk</p>
                  <p className="text-gray-300 text-sm">{strategy.portfolio_health?.top_risk}</p>
                </div>
                <div className="bg-green-950 border border-green-900 rounded-xl p-4">
                  <p className="text-green-400 text-xs font-semibold mb-1">Top Opportunity</p>
                  <p className="text-gray-300 text-sm">{strategy.portfolio_health?.top_opportunity}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
