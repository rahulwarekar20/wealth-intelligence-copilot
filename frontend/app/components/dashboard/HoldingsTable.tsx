/**
 * Ledger-style table of the user's holdings: quantity, live price, value,
 * return vs cost and portfolio weight. On large screens the remove button
 * appears when hovering a row; on touch screens it is always shown.
 */
import type { Holding, Limits } from "@/lib/types";
import { DEFAULT_LIMITS, concentrationBadge, formatMoney, formatPct, gainColor } from "@/lib/ui";
import { IconClose } from "../ui/Icons";

// Short labels for non-taxable account types (taxable shows no tag)
const ACCOUNT_LABELS: Record<string, string> = { ira: "IRA", roth_ira: "Roth", "401k": "401(k)" };

const COLUMNS = [
  { label: "Ticker", align: "text-left" },
  { label: "Qty", align: "text-right" },
  { label: "Price", align: "text-right" },
  { label: "Value", align: "text-right" },
  { label: "Return", align: "text-right" },
  { label: "Weight", align: "text-right" },
];

export default function HoldingsTable({
  holdings,
  onRemove,
  limits = DEFAULT_LIMITS,
}: {
  holdings: Holding[];
  onRemove: (holding: Holding) => void;
  /** The user's concentration thresholds, for the weight badges. */
  limits?: Limits;
}) {
  if (!holdings.length) {
    return <p className="py-6 text-center text-sm text-ink-500">No holdings yet — add your first position below.</p>;
  }

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-paper-300">
            {COLUMNS.map((c) => (
              <th key={c.label} className={`eyebrow px-2 py-2 font-semibold ${c.align}`}>{c.label}</th>
            ))}
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {holdings.map((h) => (
            <tr key={h.id} className="group border-b border-paper-200 transition hover:bg-paper-100">
              <td className="px-2 py-3">
                <span className="font-semibold text-ink-900">{h.ticker}</span>
                {h.account_type !== "taxable" && (
                  <span className="ml-2 rounded bg-paper-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-500">
                    {ACCOUNT_LABELS[h.account_type] ?? h.account_type}
                  </span>
                )}
              </td>
              <td className="px-2 py-3 text-right text-ink-700">{h.quantity}</td>
              <td className="px-2 py-3 text-right text-ink-700">{formatMoney(h.current_price)}</td>
              <td className="px-2 py-3 text-right font-medium text-ink-900">{formatMoney(h.current_value, 0)}</td>
              <td className="px-2 py-3 text-right">
                {h.gain_loss_pct === null ? (
                  <span className="text-ink-400">—</span>
                ) : (
                  <span className={gainColor(h.gain_loss_pct)}>{formatPct(h.gain_loss_pct, true)}</span>
                )}
              </td>
              <td className="px-2 py-3 text-right">
                {h.weight_pct === null ? (
                  <span className="text-xs text-ink-400">n/a</span>
                ) : (
                  <span className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold ${concentrationBadge(h.weight_pct, limits)}`}>
                    {h.weight_pct}%
                  </span>
                )}
              </td>
              <td className="px-2 py-3 text-right">
                <button
                  onClick={() => onRemove(h)}
                  className="rounded p-1 text-ink-400 transition hover:bg-brick-50 hover:text-brick-500 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  aria-label={`Remove ${h.ticker}`}
                >
                  <IconClose size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
