"use client";

/**
 * Track record ("/track-record"): every Buy / Hold / Sell call the copilot has
 * made, with the price then and now, so you can judge how its advice has
 * worked out. Repeated identical calls are shown once, from when first made.
 */
import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import ActionBadge from "../components/ui/ActionBadge";
import Callout from "../components/ui/Callout";
import { IconHistory } from "../components/ui/Icons";
import { getErrorMessage, getTrackRecord } from "@/lib/api";
import { shortDate } from "@/lib/time";
import type { TrackRecordCall, Verdict } from "@/lib/types";
import { formatMoney, formatPct, gainColor } from "@/lib/ui";
import { useRequireAuth } from "@/lib/useRequireAuth";

/** Wording and colour for each verdict (always a word, never colour alone). */
const VERDICTS: Record<Verdict, { label: string; tone: string }> = {
  on_track: { label: "On track", tone: "bg-fern-50 text-fern-700 border-fern-200" },
  against: { label: "Against the call", tone: "bg-brick-50 text-brick-600 border-brick-100" },
  flat: { label: "Flat", tone: "bg-paper-200 text-ink-600 border-paper-300" },
  too_early: { label: "Too early", tone: "bg-paper-200 text-ink-600 border-paper-300" },
  "n/a": { label: "No direction", tone: "bg-paper-200 text-ink-500 border-paper-300" },
};

/** Headline counts above the table. */
function Summary({ calls }: { calls: TrackRecordCall[] }) {
  const count = (v: Verdict) => calls.filter((c) => c.verdict === v).length;
  const judged = count("on_track") + count("against");
  const tiles = [
    { label: "Calls tracked", value: String(calls.length) },
    { label: "On track", value: judged ? `${count("on_track")} of ${judged}` : "—" },
    { label: "Against the call", value: String(count("against")) },
    { label: "Too early to tell", value: String(count("too_early")) },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-5">
          <p className="eyebrow">{t.label}</p>
          <p className="mt-2 font-display text-3xl text-ink-900">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function TrackRecordPage() {
  useRequireAuth();
  const [calls, setCalls] = useState<TrackRecordCall[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTrackRecord()
      .then(setCalls)
      .catch((err) => setError(getErrorMessage(err, "Could not load the track record.")));
  }, []);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Track record"
          title={<>How the advice has <span className="italic text-gold-500">played out</span></>}
          description="Each call the copilot made in the last 6 months, with the price then and now. Buy calls are on track if the price rose since; sell and trim calls if it fell. Past results don't predict future ones."
        />

        {error && <Callout tone="error" className="mb-6">{error}</Callout>}

        {calls === null && !error && <div className="skeleton h-64" />}

        {calls?.length === 0 && (
          <section className="card py-12 text-center">
            <IconHistory size={28} className="mx-auto text-gold-400" />
            <p className="mt-3 font-display text-xl text-ink-900">No calls yet</p>
            <p className="mt-1 text-sm text-ink-500">Ask about a stock or analyse your portfolio, and the calls will appear here.</p>
          </section>
        )}

        {calls && calls.length > 0 && (
          <>
            <Summary calls={calls} />
            <section className="card overflow-x-auto p-2 sm:p-4">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-paper-300 text-left">
                    {["Date", "Ticker", "Call", "Price then", "Price now", "Change", "So far", "From"].map((h) => (
                      <th key={h} className={`eyebrow px-3 py-2 font-semibold ${["Price then", "Price now", "Change"].includes(h) ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {calls.map((c, i) => (
                    <tr key={`${c.ticker}-${c.made_at}-${i}`} className="border-b border-paper-200">
                      <td className="whitespace-nowrap px-3 py-3 text-ink-600">{shortDate(c.made_at)}</td>
                      <td className="px-3 py-3 font-semibold text-ink-900">{c.ticker}</td>
                      <td className="px-3 py-3"><ActionBadge action={c.action} size="sm" /></td>
                      <td className="px-3 py-3 text-right text-ink-700">{formatMoney(c.price_then)}</td>
                      <td className="px-3 py-3 text-right text-ink-700">{formatMoney(c.price_now)}</td>
                      <td className={`px-3 py-3 text-right ${c.change_pct === null ? "text-ink-400" : gainColor(c.change_pct)}`}>
                        {c.change_pct === null ? "—" : formatPct(c.change_pct, true)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${VERDICTS[c.verdict].tone}`}>
                          {VERDICTS[c.verdict].label}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-xs text-ink-500" title={c.source}>{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </PageContainer>
    </PageLayout>
  );
}
