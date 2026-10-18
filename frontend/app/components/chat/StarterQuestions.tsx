/**
 * Clickable example questions shown under the greeting, grouped by topic.
 * Edit STARTER_QUESTIONS to change the suggestions.
 */
const STARTER_QUESTIONS: { label: string; questions: string[] }[] = [
  {
    label: "Stocks",
    questions: ["Should I buy more Apple?", "Is my MSFT position too large?", "AAPL or GOOGL — which looks stronger?"],
  },
  {
    label: "Portfolio",
    questions: ["How healthy is my whole portfolio?", "What should I rebalance first?"],
  },
  {
    label: "Retirement",
    questions: ["Can I retire at 60 with my current portfolio?", "How much more should I save to retire in 20 years?"],
  },
];

export default function StarterQuestions({ onAsk, disabled }: { onAsk: (question: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      {STARTER_QUESTIONS.map((group) => (
        <div key={group.label}>
          <p className="eyebrow mb-2">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.questions.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                disabled={disabled}
                className="rounded-xl border border-paper-300 bg-paper-50 px-3.5 py-2 text-sm text-ink-700 shadow-card transition hover:-translate-y-px hover:border-gold-400 hover:text-ink-900 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
