/**
 * Picks the right card for a structured copilot answer:
 * single stock, comparison (2–3 stocks), portfolio strategy, or retirement.
 */
import type { CopilotAnswer } from "@/lib/chatSession";
import RecommendationCard from "../answers/RecommendationCard";
import RetirementCard from "../answers/RetirementCard";
import StrategyCard from "../answers/StrategyCard";

/** Side-by-side comparison: one-line verdict, then a compact card per stock. */
function ComparisonView({ answer }: { answer: Extract<CopilotAnswer, { route: "comparison" }> }) {
  return (
    <div className="w-full space-y-3">
      <div className="card p-6">
        <p className="eyebrow mb-2">Comparing {answer.results.map((r) => r.ticker).join(" vs ")}</p>
        <p className="font-display text-lg italic leading-relaxed text-ink-800">
          {answer.verdict || "See each stock's analysis below."}
        </p>
      </div>
      <div className={`grid gap-3 ${answer.results.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        {answer.results.map((r) => (
          <RecommendationCard key={r.ticker} rec={r} compact preferred={answer.preferred === r.ticker} />
        ))}
      </div>
      {answer.note && <p className="text-xs text-gold-600">{answer.note}</p>}
      <p className="text-[11px] text-ink-400">{answer.results[0]?.disclosure}</p>
    </div>
  );
}

export default function AnswerView({ answer }: { answer: CopilotAnswer }) {
  switch (answer.route) {
    case "recommendation":
      return (
        <div className="w-full space-y-2">
          <RecommendationCard rec={answer} />
          {answer.note && <p className="text-xs text-gold-600">{answer.note}</p>}
        </div>
      );
    case "comparison":
      return <ComparisonView answer={answer} />;
    case "strategy":
      return <StrategyCard strategy={answer} />;
    case "retirement":
      return <RetirementCard result={answer} />;
  }
}
