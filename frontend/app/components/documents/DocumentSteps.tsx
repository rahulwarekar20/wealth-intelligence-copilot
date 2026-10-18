/**
 * "How it works" explainer for documents: upload → search → cited answer.
 */
const STEPS = [
  { title: "Upload", desc: "The text of your document is extracted and stored, linked to your account only" },
  { title: "Search", desc: "When you ask about a stock, the AI finds passages that mention that company or ticker" },
  { title: "Answer", desc: "The Evidence Agent includes those passages as a cited source in its analysis" },
];

export default function DocumentSteps() {
  return (
    <div className="card p-7">
      <h2 className="mb-5 font-display text-2xl font-medium text-ink-900">How it works</h2>
      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink-900 font-display italic text-gold-200 shadow-foil">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">{step.title}</p>
              <p className="text-sm text-ink-600">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
