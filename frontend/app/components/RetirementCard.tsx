import type { RetirementResult } from "@/lib/types";
import { formatMoney } from "@/lib/ui";

export default function RetirementCard({ result }: { result: RetirementResult }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-teal-400 font-bold text-sm">Retirement Analysis</span>
        <span className="text-gray-400 text-xs">Portfolio: {formatMoney(result.total_portfolio_value)}</span>
      </div>

      {(result.unpriced_tickers?.length ?? 0) > 0 && (
        <p className="text-yellow-400 text-xs">
          Live prices unavailable for {result.unpriced_tickers!.join(", ")} — not included in the total.
        </p>
      )}

      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-gray-100 text-[15px] leading-relaxed whitespace-pre-line">{result.answer}</p>
      </div>

      {result.portfolio_assessment && (
        <div>
          <p className="text-teal-400 text-xs font-semibold mb-1 uppercase tracking-wide">Portfolio Assessment</p>
          <p className="text-gray-300 text-sm">{result.portfolio_assessment}</p>
        </div>
      )}

      {result.action_items?.length > 0 && (
        <div>
          <p className="text-teal-400 text-xs font-semibold mb-2 uppercase tracking-wide">Recommended Actions</p>
          <div className="space-y-1.5">
            {result.action_items.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-teal-400 font-bold">→</span>
                <span className="text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.follow_up_question && (
        <div className="bg-blue-950 border border-blue-800 rounded-lg p-3">
          <p className="text-blue-300 text-sm">💬 {result.follow_up_question}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
        <span>
          Confidence:{" "}
          <span
            className={
              result.confidence === "high"
                ? "text-green-400"
                : result.confidence === "medium"
                ? "text-yellow-400"
                : "text-red-400"
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
