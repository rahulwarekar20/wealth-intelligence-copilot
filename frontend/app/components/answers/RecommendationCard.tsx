/**
 * Single-stock answer card: the Buy/Hold/Sell call, confidence, direct answer,
 * key points with filing citations, key figures, the reasoning behind the call
 * (positives vs risks) and sources.
 *
 * `compact` renders the narrower variant used side by side in comparisons;
 * `preferred` highlights the stronger pick in a comparison.
 */
import type { EvidencePoint, StockMetrics, TickerRecommendation } from "@/lib/types";
import { actionColor, formatCompactMoney, formatMoney, formatPct, shortCitation } from "@/lib/ui";
import SourceList from "./SourceList";

/** Small grey tag naming the filing section a point came from, e.g. "10-K · Item 1A". */
function CitationChip({ citation, ticker }: { citation?: string; ticker: string }) {
  if (!citation) return null;
  return (
    <span
      title={citation}
      className="ml-2 inline-block align-middle rounded-md bg-paper-200 px-1.5 py-0.5 text-[11px] font-medium text-ink-600 whitespace-nowrap"
    >
      {shortCitation(citation, ticker)}
    </span>
  );
}

/** Thin bar showing the copilot's confidence (0–1) as a percentage. */
function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 70 ? "bg-fern-500" : pct >= 40 ? "bg-gold-400" : "bg-brick-400";
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence`}>
      <div className="h-1.5 w-16 rounded-full bg-paper-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-600 tabular-nums">{pct}%</span>
    </div>
  );
}

/** Grid of key figures (price, revenue, margins, P/E...). Only metrics that are present are shown. */
function MetricTiles({ m, compact = false }: { m?: StockMetrics; compact?: boolean }) {
  if (!m) return null;
  const fy = m.fiscal_year_end ? `FY${m.fiscal_year_end.slice(0, 4)}` : "";
  const tiles: { label: string; value: string; tone?: string }[] = [];
  if (m.price !== undefined) tiles.push({ label: "Price", value: formatMoney(m.price) });
  if (m.daily_change_pct !== undefined)
    tiles.push({
      label: "Today",
      value: formatPct(m.daily_change_pct, true),
      tone: m.daily_change_pct >= 0 ? "text-fern-600" : "text-brick-500",
    });
  if (m.revenue !== undefined) tiles.push({ label: `Revenue ${fy}`, value: formatCompactMoney(m.revenue) });
  if (m.revenue_growth_pct !== undefined)
    tiles.push({
      label: "Rev. growth",
      value: formatPct(m.revenue_growth_pct, true),
      tone: m.revenue_growth_pct >= 0 ? "text-fern-600" : "text-brick-500",
    });
  if (m.net_margin_pct !== undefined) tiles.push({ label: "Net margin", value: formatPct(m.net_margin_pct) });
  if (m.pe_ratio !== undefined) tiles.push({ label: "P/E", value: m.pe_ratio.toFixed(1) });
  if (m.portfolio_weight_pct !== undefined)
    tiles.push({ label: "Your weight", value: formatPct(m.portfolio_weight_pct) });
  if (!tiles.length) return null;

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-7"}`}>
      {tiles.map((t) => (
        <div key={t.label} className="card-inset px-3 py-2">
          <p className="eyebrow truncate !tracking-wider">{t.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${t.tone ?? "text-ink-900"}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Bulleted evidence points, each with its citation chip. */
function PointList({ points, ticker, bullet }: { points?: EvidencePoint[]; ticker: string; bullet: string }) {
  if (!points?.length) return null;
  return (
    <ul className="space-y-1.5">
      {points.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-ink-800">
          <span className={`mt-0.5 shrink-0 ${bullet}`}>●</span>
          <span>
            {p.point}
            <CitationChip citation={p.citation} ticker={ticker} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function RecommendationCard({
  rec,
  compact = false,
  preferred = false,
}: {
  rec: TickerRecommendation;
  compact?: boolean;
  preferred?: boolean;
}) {
  const company = rec.metrics?.company;

  // Compact variant for side-by-side comparisons
  if (compact) {
    return (
      <div className={`card flex flex-col gap-3 p-5 ${preferred ? "!border-gold-300 shadow-foil" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-2xl font-medium text-ink-900">
              {rec.ticker}
              {preferred && (
                <span className="rounded border border-gold-200 bg-gold-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                  Stronger pick
                </span>
              )}
            </p>
            {company && <p className="truncate text-xs text-ink-500 capitalize">{company.toLowerCase()}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${actionColor(rec.action)}`}>
              {rec.action}
            </span>
            <ConfidenceMeter value={rec.confidence} />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-ink-800">{rec.answer || rec.summary}</p>
        <MetricTiles m={rec.metrics} compact />
        <PointList points={rec.key_points?.slice(0, 3)} ticker={rec.ticker} bullet="text-gold-500 text-[8px]" />
        {(rec.sources?.length ?? 0) > 0 && (
          <details className="group mt-auto">
            <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-800">
              <span className="inline-block transition group-open:rotate-90">›</span> Sources ({rec.sources!.length})
            </summary>
            <SourceList sources={rec.sources} heading={false} />
          </details>
        )}
      </div>
    );
  }

  const hasDetails = (rec.evidence_for?.length ?? 0) + (rec.evidence_against?.length ?? 0) > 0;

  return (
    <div className="card w-full space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-medium text-ink-900">{rec.ticker}</span>
          {company && <span className="text-sm text-ink-500 capitalize">{company.toLowerCase()}</span>}
        </div>
        <div className="flex items-center gap-3">
          {rec.disagreement_flag && (
            <span className="rounded border border-gold-200 bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-700" title={rec.disagreement_note || undefined}>
              Agents disagree
            </span>
          )}
          <span className={`rounded-lg border px-3 py-1 text-sm font-bold uppercase ${actionColor(rec.action)}`}>
            {rec.action}
          </span>
          <ConfidenceMeter value={rec.confidence} />
        </div>
      </div>

      {/* Direct answer to the question */}
      <p className="text-[15px] leading-relaxed text-ink-800">{rec.answer || rec.summary}</p>

      <PointList points={rec.key_points} ticker={rec.ticker} bullet="text-gold-500 text-[8px]" />

      <MetricTiles m={rec.metrics} />

      {/* Reasoning behind the action, folded away */}
      <details className="group card-inset px-4 py-3">
        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="text-ink-700">
            <span className="font-semibold text-ink-900">Why {rec.action.toUpperCase()}:</span> {rec.summary}
          </span>
          {hasDetails && <span className="shrink-0 text-ink-500 transition group-open:rotate-90">›</span>}
        </summary>
        {hasDetails && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fern-600">Positives</p>
              <PointList points={rec.evidence_for} ticker={rec.ticker} bullet="text-fern-500 text-[8px]" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brick-500">Risks</p>
              <PointList points={rec.evidence_against} ticker={rec.ticker} bullet="text-brick-400 text-[8px]" />
            </div>
          </div>
        )}
      </details>

      {(rec.sources?.length ?? 0) > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-800">
            <span className="inline-block transition group-open:rotate-90">›</span> Sources ({rec.sources!.length})
          </summary>
          <SourceList sources={rec.sources} heading={false} />
        </details>
      )}

      <p className="text-[11px] text-ink-400">{rec.disclosure}</p>
    </div>
  );
}
