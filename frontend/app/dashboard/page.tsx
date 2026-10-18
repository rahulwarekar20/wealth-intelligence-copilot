"use client";

/**
 * Dashboard ("/dashboard"): portfolio value, health, holdings, concentration
 * and the AI strategy on one screen.
 *
 * Data: usePortfolio (holdings + live prices) and useStrategy (AI analysis,
 * shared with Analyse Portfolio). The cards themselves live in
 * components/dashboard/.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import AddHoldingForm from "../components/dashboard/AddHoldingForm";
import ConcentrationCard from "../components/dashboard/ConcentrationCard";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import HealthSummaryCard from "../components/dashboard/HealthSummaryCard";
import HoldingsTable from "../components/dashboard/HoldingsTable";
import ImportHoldings from "../components/dashboard/ImportHoldings";
import PortfolioValueCard from "../components/dashboard/PortfolioValueCard";
import StrategyPanel from "../components/dashboard/StrategyPanel";
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import RiskOpportunity from "../components/strategy/RiskOpportunity";
import Callout from "../components/ui/Callout";
import { IconChat, IconPrinter, IconUpload } from "../components/ui/Icons";
import { useStrategy } from "@/lib/strategy";
import { usePortfolio } from "@/lib/usePortfolio";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { Holding } from "@/lib/types";

// Short pause before an automatic analysis, so adding several holdings in a row
// triggers one run instead of one per change
const AUTO_RUN_DELAY_MS = 800;

export default function DashboardPage() {
  useRequireAuth();
  // Strategy is shared with Analyse Portfolio, kept for the session, and cleared whenever holdings change
  const { strategy, running, error: strategyError, run: runStrategy, clear: clearStrategy } = useStrategy();
  const { portfolio, loading, error: loadError, add, remove, refresh } = usePortfolio(clearStrategy);
  const [importing, setImporting] = useState(false);

  // Run the AI strategy automatically, in parallel with the portfolio load: on
  // first visit, and again after holdings change (which clears the saved result).
  // A failed run (or "no holdings yet") waits for the user, so errors don't loop.
  const hasHoldings = (portfolio?.holdings?.length ?? 0) > 0;
  const firstRun = portfolio === null;
  useEffect(() => {
    if (strategy || running || strategyError) return;
    // Automatic loads may reuse a recent strategy (server-side); Refresh forces a new one
    const timer = setTimeout(() => runStrategy(), firstRun ? 0 : AUTO_RUN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [firstRun, strategy, running, strategyError, runStrategy]);

  const handleRemove = (h: Holding) => {
    if (window.confirm(`Remove ${h.ticker} from your portfolio?`)) remove(h.id);
  };

  const health = strategy && !running ? strategy.portfolio_health : undefined;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <PageLayout>
      <PageContainer>
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <PageHeader
              eyebrow={today}
              title={<>Your portfolio, <span className="italic text-gold-500">at a glance</span></>}
              description="Live value and allocation alongside the copilot's read on every position."
              actions={
                <>
                  <Link href="/report" className="btn-secondary px-4 py-2 text-sm">
                    <IconPrinter size={16} /> Advisor report
                  </Link>
                  <Link href="/chat" className="btn-secondary px-4 py-2 text-sm">
                    <IconChat size={16} /> Ask Copilot
                  </Link>
                </>
              }
            />

            {loadError && <Callout tone="error" className="mb-6">{loadError}</Callout>}

            {/* Overview band: value + allocation, health score */}
            <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <PortfolioValueCard
                totalValue={portfolio?.total_value ?? 0}
                holdings={portfolio?.holdings ?? []}
                unpricedTickers={portfolio?.unpriced_tickers ?? []}
                otherAssetsTotal={portfolio?.other_assets_total ?? 0}
                pricesAsOf={portfolio?.prices_as_of}
              />
              <HealthSummaryCard health={health} failed={!!strategyError} hasHoldings={hasHoldings} />
            </section>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
              {/* Left: holdings and concentration */}
              <div className="space-y-6">
                <section className="card p-4 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-2xl font-medium text-ink-900">Holdings</h2>
                    {!importing && (
                      <button onClick={() => setImporting(true)} className="btn-secondary px-3 py-1.5 text-sm">
                        <IconUpload size={15} /> Import from broker
                      </button>
                    )}
                  </div>
                  {importing && <ImportHoldings onImported={refresh} onClose={() => setImporting(false)} />}
                  <HoldingsTable holdings={portfolio?.holdings ?? []} onRemove={handleRemove} limits={portfolio?.limits} />
                  <AddHoldingForm onAdd={add} />
                </section>
                <ConcentrationCard holdings={portfolio?.holdings ?? []} limits={portfolio?.limits} />
              </div>

              {/* Right: AI strategy */}
              <div className="space-y-6">
                <StrategyPanel
                  strategy={strategy}
                  running={running}
                  error={strategyError}
                  hasHoldings={hasHoldings}
                  onRun={() => runStrategy(true)}
                />
                {health && <RiskOpportunity risk={health.top_risk} opportunity={health.top_opportunity} />}
              </div>
            </div>

            <p className="mt-10 text-center text-xs text-ink-400">Informational only. Not personalised investment advice.</p>
          </>
        )}
      </PageContainer>
    </PageLayout>
  );
}
