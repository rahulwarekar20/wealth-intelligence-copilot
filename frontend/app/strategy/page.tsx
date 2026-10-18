"use client";

/**
 * Analyse Portfolio ("/strategy"): the full AI strategy — health overview,
 * priority actions and a card per position. The result is shared with the
 * Dashboard through useStrategy; sections live in components/strategy/.
 */
import { useEffect } from "react";
import SourceList from "../components/answers/SourceList";
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import HealthOverview from "../components/strategy/HealthOverview";
import PositionCard from "../components/strategy/PositionCard";
import PriorityActions from "../components/strategy/PriorityActions";
import RecommendationMix from "../components/strategy/RecommendationMix";
import StrategyChangesNote from "../components/strategy/StrategyChangesNote";
import StrategyLoading from "../components/strategy/StrategyLoading";
import Callout from "../components/ui/Callout";
import { IconRefresh } from "../components/ui/Icons";
import { useStrategy } from "@/lib/strategy";
import { timeAgo } from "@/lib/time";
import { useRequireAuth } from "@/lib/useRequireAuth";

export default function StrategyPage() {
  useRequireAuth();
  // Shared with the Dashboard: a result or a run already in progress there is reused here
  const { strategy, running: loading, error, run } = useStrategy();
  const runStrategy = () => run();

  // Start automatically when there's no saved result (a failed run waits for "Try again")
  useEffect(() => {
    if (strategy || loading || error) return;
    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  }, [strategy, loading, error, run]);

  const ready = strategy && !loading;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Analyse portfolio"
          title={<>Portfolio <span className="italic text-gold-500">strategy</span></>}
          description="The copilot's view across all of your positions at once — what to keep, what to trim, and what to do first."
          actions={
            ready ? (
              <>
                {strategy.generated_at && <span className="text-xs text-ink-500">Analysed {timeAgo(strategy.generated_at)}</span>}
                <button onClick={runStrategy} className="btn-secondary px-4 py-2 text-sm">
                  <IconRefresh size={15} /> Refresh
                </button>
              </>
            ) : undefined
          }
        />

        {(loading || (!strategy && !error)) && <StrategyLoading />}

        {error && !loading && (
          <Callout tone="error" className="mb-6 p-5">
            <p>{error}</p>
            <button onClick={runStrategy} className="btn-primary mt-3 px-4 py-2 text-sm">Try again</button>
          </Callout>
        )}

        {ready && (
          <div className="space-y-6">
            <StrategyChangesNote changes={strategy.changes} />
            <HealthOverview strategy={strategy} />

            {/* What to do first, next to how much of the portfolio each call covers */}
            <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
              <PriorityActions actions={strategy.priority_actions} />
              <RecommendationMix positions={strategy.positions ?? []} />
            </div>

            <section>
              <h2 className="mb-4 font-display text-2xl font-medium text-ink-900">Position by position</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {strategy.positions?.map((pos) => <PositionCard key={pos.ticker} position={pos} />)}
              </div>
            </section>

            {(strategy.sources?.length ?? 0) > 0 && (
              <section className="card p-6">
                <SourceList sources={strategy.sources} />
              </section>
            )}

            <p className="pb-4 text-center text-xs text-ink-400">
              Informational only. Not personalized investment advice. Consult a qualified financial advisor before making investment decisions.
            </p>
          </div>
        )}
      </PageContainer>
    </PageLayout>
  );
}
