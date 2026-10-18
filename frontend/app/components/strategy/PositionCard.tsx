/**
 * One position on Analyse Portfolio: the recommended action, concentration
 * level, price and return vs cost, the reasoning, and its key risk / opportunity.
 */
import type { StrategyPosition } from "@/lib/types";
import { concentrationFlagColor, formatMoney, gainColor } from "@/lib/ui";
import ActionBadge from "../ui/ActionBadge";

/** Small left-ruled note for a risk or an opportunity. */
function Note({ label, text, tone }: { label: string; text: string; tone: "risk" | "opportunity" }) {
  const rule = tone === "risk" ? "border-l-brick-300" : "border-l-fern-300";
  const color = tone === "risk" ? "text-brick-500" : "text-fern-600";
  return (
    <div className={`card-inset border-l-[3px] ${rule} px-3 py-2`}>
      <p className={`eyebrow ${color}`}>{label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-700">{text}</p>
    </div>
  );
}

// The flag comes from the AI's JSON; anything other than these (e.g. "NONE") is not shown
const KNOWN_FLAGS = ["HIGH", "MEDIUM", "LOW"];

export default function PositionCard({ position: pos }: { position: StrategyPosition }) {
  const flag = KNOWN_FLAGS.includes(pos.concentration_flag?.toUpperCase() ?? "") ? pos.concentration_flag! : null;
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-medium text-ink-900">{pos.ticker}</span>
            <ActionBadge action={pos.action} />
          </div>
          {flag && (
            <p className={`mt-1 text-xs font-semibold first-letter:uppercase ${concentrationFlagColor(flag)}`}>
              {flag.toLowerCase()} concentration
            </p>
          )}
        </div>
        <div className="text-right tabular-nums">
          <p className="font-semibold text-ink-900">{formatMoney(pos.current_price)}</p>
          {pos.gain_loss_pct !== null && pos.gain_loss_pct !== undefined && (
            <p className={`text-xs ${gainColor(pos.gain_loss_pct)}`}>
              {pos.gain_loss_pct >= 0 ? "+" : ""}{pos.gain_loss_pct.toFixed(2)}% vs cost
            </p>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ink-700">{pos.reasoning}</p>

      <div className="mt-auto space-y-2">
        {pos.key_risk && <Note label="Risk" text={pos.key_risk} tone="risk" />}
        {pos.key_opportunity && <Note label="Opportunity" text={pos.key_opportunity} tone="opportunity" />}
      </div>
    </div>
  );
}
