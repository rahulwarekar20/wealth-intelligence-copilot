/**
 * Side-by-side "Top risk" / "Top opportunity" boxes from the strategy's
 * portfolio health. `variant="card"` stands alone (dashboard);
 * `variant="inset"` sits inside another card (Analyse Portfolio).
 */
export default function RiskOpportunity({
  risk,
  opportunity,
  variant = "card",
}: {
  risk?: string;
  opportunity?: string;
  variant?: "card" | "inset";
}) {
  const box = variant === "card" ? "card p-5" : "card-inset p-4";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={`${box} border-l-4 border-l-brick-300`}>
        <p className="eyebrow text-brick-500">Top risk</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{risk}</p>
      </div>
      <div className={`${box} border-l-4 border-l-fern-300`}>
        <p className="eyebrow text-fern-600">Top opportunity</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{opportunity}</p>
      </div>
    </div>
  );
}
