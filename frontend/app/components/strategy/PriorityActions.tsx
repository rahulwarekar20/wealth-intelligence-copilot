/**
 * Ranked list of what the copilot would do first across the portfolio.
 */
import type { PortfolioStrategy } from "@/lib/types";
import ActionBadge from "../ui/ActionBadge";

export default function PriorityActions({ actions }: { actions: PortfolioStrategy["priority_actions"] }) {
  if (!actions?.length) return null;

  return (
    <section className="card p-7">
      <h2 className="font-display text-2xl font-medium text-ink-900">Priority actions</h2>
      <p className="mt-1 text-sm text-ink-500">In the order the copilot would tackle them.</p>
      <ol className="mt-5 divide-y divide-paper-200 border-y border-paper-200">
        {actions.map((a) => (
          <li key={`${a.rank}-${a.ticker}`} className="flex items-center gap-4 py-4">
            <span className="w-8 font-display text-3xl italic leading-none text-gold-400">{a.rank}</span>
            <span className="w-16 font-semibold text-ink-900">{a.ticker}</span>
            <ActionBadge action={a.action} className="w-24 shrink-0 py-1" />
            <p className="flex-1 text-sm text-ink-700">{a.reason}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
