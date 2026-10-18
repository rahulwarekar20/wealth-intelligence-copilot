/**
 * Retirement answer card: the copilot's answer, portfolio assessment,
 * recommended actions, any follow-up question it needs answered, and confidence.
 */
import type { RetirementResult } from "@/lib/types";
import { formatMoney } from "@/lib/ui";

export default function RetirementCard({ result }: { result: RetirementResult }) {
  return (
    <div className="card p-6 w-full space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-medium text-ink-900">Retirement analysis</span>
        <span className="text-ink-600 text-xs">Portfolio: {formatMoney(result.total_portfolio_value)}</span>
      </div>

      {(result.unpriced_tickers?.length ?? 0) > 0 && (
        <p className="text-gold-600 text-xs">
          Live prices unavailable for {result.unpriced_tickers!.join(", ")} — not included in the total.
        </p>
      )}

      <div className="card-inset p-4">
        <p className="text-ink-800 text-[15px] leading-relaxed whitespace-pre-line">{result.answer}</p>
      </div>

      {result.portfolio_assessment && (
        <div>
          <p className="eyebrow mb-1.5">Portfolio Assessment</p>
          <p className="text-ink-700 text-sm">{result.portfolio_assessment}</p>
        </div>
      )}

      {result.action_items?.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Recommended Actions</p>
          <div className="space-y-1.5">
            {result.action_items.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-bold text-gold-500">→</span>
                <span className="text-ink-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.follow_up_question && (
        <div className="bg-harbor-50 border border-harbor-200 rounded-lg p-3">
          <p className="text-harbor-700 text-sm">{result.follow_up_question}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-xs text-ink-500 border-t border-paper-300 pt-3">
        <span>
          Confidence:{" "}
          <span
            className={
              result.confidence === "high"
                ? "text-fern-600"
                : result.confidence === "medium"
                ? "text-gold-600"
                : "text-brick-500"
            }
          >
            {result.confidence}
          </span>
        </span>
        <span className="text-right">{result.disclaimer}</span>
      </div>
    </div>
  );
}
