import type { EvidencePoint, StockMetrics, TickerRecommendation } from "@/lib/types";
import { actionColor, formatCompactMoney, formatMoney, formatPct, shortCitation } from "@/lib/ui";
import SourceList from "./SourceList";

function CitationChip({ citation, ticker }: { citation?: string; ticker: string }) {
  if (!citation) return null;
  return (
    <span
      title={citation}
      className="ml-2 inline-block align-middle rounded-md bg-gray-800 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 whitespace-nowrap"
    >
      {shortCitation(citation, ticker)}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" title={`${pct}% confidence`}>
      <div className="h-1.5 w-16 rounded-full bg-gray-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
    </div>
  );
}

function MetricTiles({ m, compact = false }: { m?: StockMetrics; compact?: boolean }) {
  if (!m) return null;
  const fy = m.fiscal_year_end ? `FY${m.fiscal_year_end.slice(0, 4)}` : "";
  const tiles: { label: string; value: string; tone?: string }[] = [];
  if (m.price !== undefined) tiles.push({ label: "Price", value: formatMoney(m.price) });
  if (m.daily_change_pct !== undefined)
    tiles.push({
      label: "Today",
      value: formatPct(m.daily_change_pct, true),
      tone: m.daily_change_pct >= 0 ? "text-green-400" : "text-red-400",
    });
  if (m.revenue !== undefined) tiles.push({ label: `Revenue ${fy}`, value: formatCompactMoney(m.revenue) });
  if (m.revenue_growth_pct !== undefined)
    tiles.push({
      label: "Rev. growth",
      value: formatPct(m.revenue_growth_pct, true),
      tone: m.revenue_growth_pct >= 0 ? "text-green-400" : "text-red-400",
    });
  if (m.net_margin_pct !== undefined) tiles.push({ label: "Net margin", value: formatPct(m.net_margin_pct) });
  if (m.pe_ratio !== undefined) tiles.push({ label: "P/E", value: m.pe_ratio.toFixed(1) });
  if (m.portfolio_weight_pct !== undefined)
    tiles.push({ label: "Your weight", value: formatPct(m.portfolio_weight_pct) });
  if (!tiles.length) return null;

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-7"}`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg bg-gray-800/60 px-3 py-2">
          <p className="truncate text-[11px] uppercase tracking-wide text-gray-500">{t.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${t.tone ?? "text-gray-100"}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function PointList({ points, ticker, bullet }: { points?: EvidencePoint[]; ticker: string; bullet: string }) {
  if (!points?.length) return null;
  return (
    <ul className="space-y-1.5">
      {points.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-gray-200">
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
      <div className={`flex flex-col gap-3 rounded-2xl border bg-gray-900 p-4 ${preferred ? "border-teal-600" : "border-gray-800"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-bold text-teal-400">
              {rec.ticker}
              {preferred && (
                <span className="rounded bg-teal-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                  Stronger pick
                </span>
              )}
            </p>
            {company && <p className="truncate text-xs text-gray-500 capitalize">{company.toLowerCase()}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${actionColor(rec.action)}`}>
              {rec.action}
            </span>
            <ConfidenceMeter value={rec.confidence} />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-gray-200">{rec.answer || rec.summary}</p>
        <MetricTiles m={rec.metrics} compact />
        <PointList points={rec.key_points?.slice(0, 3)} ticker={rec.ticker} bullet="text-teal-500 text-[8px]" />
        {(rec.sources?.length ?? 0) > 0 && (
          <details className="group mt-auto">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
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
    <div className="w-full space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-teal-400">{rec.ticker}</span>
          {company && <span className="text-sm text-gray-500 capitalize">{company.toLowerCase()}</span>}
        </div>
        <div className="flex items-center gap-3">
          {rec.disagreement_flag && (
            <span className="rounded bg-orange-900/60 px-2 py-0.5 text-xs text-orange-300" title={rec.disagreement_note || undefined}>
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
      <p className="text-[15px] leading-relaxed text-gray-100">{rec.answer || rec.summary}</p>

      <PointList points={rec.key_points} ticker={rec.ticker} bullet="text-teal-500 text-[8px]" />

      <MetricTiles m={rec.metrics} />

      {/* Reasoning behind the action, folded away */}
      <details className="group rounded-xl bg-gray-800/40 px-4 py-3">
        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="text-gray-300">
            <span className="font-semibold text-white">Why {rec.action.toUpperCase()}:</span> {rec.summary}
          </span>
          {hasDetails && <span className="shrink-0 text-gray-500 transition group-open:rotate-90">›</span>}
        </summary>
        {hasDetails && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-400">Positives</p>
              <PointList points={rec.evidence_for} ticker={rec.ticker} bullet="text-green-500 text-[8px]" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">Risks</p>
              <PointList points={rec.evidence_against} ticker={rec.ticker} bullet="text-red-500 text-[8px]" />
            </div>
          </div>
        )}
      </details>

      {(rec.sources?.length ?? 0) > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
            <span className="inline-block transition group-open:rotate-90">›</span> Sources ({rec.sources!.length})
          </summary>
          <SourceList sources={rec.sources} heading={false} />
        </details>
      )}

      <p className="text-[11px] text-gray-600">{rec.disclosure}</p>
    </div>
  );
}
