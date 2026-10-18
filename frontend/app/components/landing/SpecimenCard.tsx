/**
 * Illustrative example of a copilot answer, shown on the landing page so
 * visitors can see the output before signing in. It is static and labelled
 * "illustrative" — it is not live data.
 */

/** One evidence bullet with its source tag. */
function Point({ text, source, tone }: { text: string; source: string; tone: "positive" | "risk" }) {
  return (
    <li className="flex gap-2">
      <span className={tone === "positive" ? "text-fern-500" : "text-brick-400"}>●</span>
      <span>
        {text}{" "}
        <span className="ml-1 rounded bg-paper-200 px-1.5 py-0.5 text-[11px] text-ink-500">{source}</span>
      </span>
    </li>
  );
}

export default function SpecimenCard() {
  return (
    <div className="card relative overflow-hidden p-6 shadow-book md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Example analysis · illustrative</p>
          <p className="mt-1 font-display text-lg italic text-ink-700">“Is my MSFT position too large?”</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-1 text-sm font-bold uppercase text-gold-700">
            Trim
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-paper-200">
              <div className="h-1.5 w-[72%] rounded-full bg-fern-500" />
            </div>
            <span className="text-xs tabular-nums text-ink-500">72%</span>
          </div>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-ink-800">
        At 31% of your portfolio, a single position now drives most of your risk. The business remains strong, but
        trimming toward 20% would lock in gains without exiting a holding you believe in.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="card-inset p-4">
          <p className="eyebrow mb-2 text-fern-600">Positives</p>
          <ul className="space-y-1.5 text-sm text-ink-700">
            <Point tone="positive" text="Cloud revenue growth remains durable" source="10-K · MD&A" />
            <Point tone="positive" text="Healthy net margin and cash generation" source="10-K financials" />
          </ul>
        </div>
        <div className="card-inset p-4">
          <p className="eyebrow mb-2 text-brick-500">Risks</p>
          <ul className="space-y-1.5 text-sm text-ink-700">
            <Point tone="risk" text="Position exceeds a 25% concentration limit" source="portfolio data" />
            <Point tone="risk" text="Competition and regulatory exposure" source="10-K · Item 1A" />
          </ul>
        </div>
      </div>
    </div>
  );
}
