"use client";

/**
 * Advisor report ("/report"): a one-page summary to share with a financial
 * advisor or partner — profile, net worth, holdings with the copilot's call
 * on each, allocation, other assets and the strategy. Designed for printing:
 * "Print / Save as PDF" uses the browser's print dialog.
 *
 * It reuses the session's strategy (from the Dashboard / Analyse Portfolio)
 * and runs one if there isn't one yet.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "../components/brand/Logo";
import ActionBadge from "../components/ui/ActionBadge";
import Callout from "../components/ui/Callout";
import DonutChart from "../components/ui/DonutChart";
import { IconPrinter } from "../components/ui/Icons";
import { ASSET_CLASS_LABELS } from "../components/profile/OtherAssetsCard";
import { getErrorMessage, getMe, getPortfolioSummary, getProfile, listAssets } from "@/lib/api";
import { allocationSlices } from "@/lib/charts";
import { useStrategy } from "@/lib/strategy";
import { clockTime, shortDate } from "@/lib/time";
import type { OtherAsset, PortfolioSummary, Profile } from "@/lib/types";
import { concentrationLevel, formatMoney, formatPct } from "@/lib/ui";
import { useRequireAuth } from "@/lib/useRequireAuth";

interface ReportData {
  email: string;
  summary: PortfolioSummary;
  profile: Profile;
  assets: OtherAsset[];
}

/** Section heading used throughout the report. */
function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b border-paper-300 pb-1.5 font-display text-xl font-medium text-ink-900">{children}</h2>;
}

/** A labelled figure in the key-figures row. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

export default function ReportPage() {
  useRequireAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const { strategy, running, error: strategyError, run } = useStrategy();

  // Load everything the report needs in parallel
  useEffect(() => {
    Promise.all([getMe(), getPortfolioSummary(), getProfile(), listAssets()])
      .then(([me, summary, profile, assets]) => setData({ email: me.email, summary, profile, assets: assets.assets }))
      .catch((err) => setError(getErrorMessage(err, "Could not load the report.")));
  }, []);

  // Make sure there is a strategy to include
  useEffect(() => {
    if (strategy || running || strategyError) return;
    const timer = setTimeout(() => run(), 0);
    return () => clearTimeout(timer);
  }, [strategy, running, strategyError, run]);

  const callFor = (ticker: string) => strategy?.positions?.find((p) => p.ticker === ticker)?.action;
  const health = strategy?.portfolio_health;
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 print:max-w-none print:p-0">
      {/* Controls (not printed) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="link text-sm">← Back to dashboard</Link>
        <button onClick={() => window.print()} disabled={!data || running} className="btn-primary px-5 py-2.5 text-sm">
          <IconPrinter size={16} /> Print / Save as PDF
        </button>
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {!data && !error && <div className="skeleton h-96" />}

      {data && (
        <article className="card space-y-8 p-6 sm:p-10 print:border-0 print:p-0">
          {/* Title block */}
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Wordmark size={32} />
              <h1 className="mt-4 font-display text-3xl font-medium text-ink-900">Portfolio summary</h1>
              <p className="mt-1 text-sm text-ink-600">
                Prepared for {data.email} on {shortDate(now)} at {clockTime(now)}
              </p>
            </div>
            <div className="text-right text-sm text-ink-600">
              <p className="eyebrow">Investor profile</p>
              <p className="mt-1 capitalize">{data.profile.risk_tolerance} risk</p>
              <p>{data.profile.horizon_years ? `${data.profile.horizon_years}-year horizon` : "Horizon not set"}</p>
              <p>Max {data.profile.max_position_pct}% per position</p>
            </div>
          </header>

          {/* Key figures */}
          <section className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Figure label="Net worth" value={formatMoney(data.summary.net_worth, 0)} />
            <Figure label="Investments" value={formatMoney(data.summary.total_value, 0)} />
            <Figure label="Other assets" value={formatMoney(data.summary.other_assets_total, 0)} />
            <Figure label="Health score" value={health ? `${health.overall_score ?? 0}/100` : running ? "…" : "—"} />
          </section>

          {/* Holdings */}
          <section>
            <Heading>Holdings</Heading>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left">
                    {["Ticker", "Qty", "Price", "Value", "Weight", "Return", "Risk", "Copilot call"].map((h) => (
                      <th key={h} className={`eyebrow py-1.5 pr-3 ${["Qty", "Price", "Value", "Weight", "Return"].includes(h) ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.summary.holdings.map((h) => (
                    <tr key={h.id} className="border-t border-paper-200">
                      <td className="py-2 pr-3 font-semibold text-ink-900">{h.ticker}</td>
                      <td className="py-2 pr-3 text-right">{h.quantity}</td>
                      <td className="py-2 pr-3 text-right">{formatMoney(h.current_price)}</td>
                      <td className="py-2 pr-3 text-right">{formatMoney(h.current_value, 0)}</td>
                      <td className="py-2 pr-3 text-right">{h.weight_pct === null ? "—" : `${h.weight_pct}%`}</td>
                      <td className="py-2 pr-3 text-right">{h.gain_loss_pct === null ? "—" : formatPct(h.gain_loss_pct, true)}</td>
                      <td className="py-2 pr-3">{h.weight_pct === null ? "—" : concentrationLevel(h.weight_pct, data.summary.limits)}</td>
                      <td className="py-2">{callFor(h.ticker) ? <ActionBadge action={callFor(h.ticker)!} size="sm" /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.summary.prices_as_of && (
              <p className="mt-2 text-xs text-ink-500">Prices as of {clockTime(data.summary.prices_as_of)}.</p>
            )}
          </section>

          {/* Allocation and other assets */}
          <section className="grid gap-8 md:grid-cols-2 print:grid-cols-2">
            <div>
              <Heading>Allocation</Heading>
              {allocationSlices(data.summary.holdings).length > 0 ? (
                <DonutChart
                  slices={allocationSlices(data.summary.holdings)}
                  title="Allocation by position"
                  centerLabel="positions"
                  centerValue={String(data.summary.holdings.length)}
                />
              ) : (
                <p className="text-sm text-ink-500">No priced holdings.</p>
              )}
            </div>
            <div>
              <Heading>Other assets</Heading>
              {data.assets.length ? (
                <table className="w-full text-sm">
                  <tbody className="tabular-nums">
                    {data.assets.map((a) => (
                      <tr key={a.id} className="border-b border-paper-200">
                        <td className="py-2">{a.name}</td>
                        <td className="py-2 text-ink-500">{ASSET_CLASS_LABELS[a.asset_class]}</td>
                        <td className="py-2 text-right">{formatMoney(a.value, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-ink-500">None recorded.</p>
              )}
            </div>
          </section>

          {/* Strategy */}
          <section>
            <Heading>Copilot strategy</Heading>
            {running && <p className="text-sm text-ink-500">Analysing the portfolio… (10–20 seconds)</p>}
            {strategyError && <p className="text-sm text-brick-600">Strategy unavailable: {strategyError}</p>}
            {strategy && !running && (
              <div className="space-y-4 text-sm">
                <p className="font-display text-base italic text-ink-700">{health?.summary}</p>
                <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
                  <p><span className="eyebrow text-brick-500">Top risk</span><br />{health?.top_risk}</p>
                  <p><span className="eyebrow text-fern-600">Top opportunity</span><br />{health?.top_opportunity}</p>
                </div>
                {strategy.priority_actions?.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1">Priority actions</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      {strategy.priority_actions.map((a) => (
                        <li key={`${a.rank}-${a.ticker}`}>
                          <span className="font-semibold">{a.action.toUpperCase()} {a.ticker}</span> — {a.reason}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {strategy.generated_at && <p className="text-xs text-ink-500">Analysis run {shortDate(strategy.generated_at)} at {clockTime(strategy.generated_at)}.</p>}
              </div>
            )}
          </section>

          <footer className="border-t border-paper-300 pt-4 text-xs leading-relaxed text-ink-500">
            Generated by Wealth Intelligence Copilot from public SEC filings, market data and information provided by
            the account holder. Informational only — not personalised investment advice. Figures may be delayed or
            incomplete; verify before acting.
          </footer>
        </article>
      )}
    </div>
  );
}
