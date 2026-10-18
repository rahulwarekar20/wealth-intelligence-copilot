"use client";

/**
 * Alerts ("/alerts"): everything the copilot has noticed about your holdings —
 * positions over your limit, big daily drops, new SEC filings, upcoming
 * earnings and strategy changes. Each alert links to a ready-made question.
 */
import Link from "next/link";
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import { IconBell, IconCompass, IconDocument, IconScale, IconSunrise } from "../components/ui/Icons";
import { timeAgo } from "@/lib/time";
import type { AlertKind, AppAlert } from "@/lib/types";
import { useAlerts } from "@/lib/useAlerts";
import { useRequireAuth } from "@/lib/useRequireAuth";

/** Label, icon, colour and follow-up question for each kind of alert. */
const KINDS: Record<AlertKind, { label: string; Icon: typeof IconBell; tone: string; question: (t: string) => string }> = {
  concentration: { label: "Over your limit", Icon: IconScale, tone: "text-brick-500 bg-brick-50", question: (t) => `Should I trim my ${t} position?` },
  price_drop: { label: "Price drop", Icon: IconBell, tone: "text-brick-500 bg-brick-50", question: (t) => `Why is ${t} down today? Should I worry?` },
  filing: { label: "New filing", Icon: IconDocument, tone: "text-harbor-600 bg-harbor-50", question: (t) => `What changed in ${t}'s latest SEC filing?` },
  earnings: { label: "Earnings soon", Icon: IconSunrise, tone: "text-gold-600 bg-gold-50", question: (t) => `What should I watch for in ${t}'s earnings?` },
  strategy_change: { label: "Strategy changed", Icon: IconCompass, tone: "text-fern-600 bg-fern-50", question: () => "What changed in my portfolio strategy and why?" },
};

/** One alert row: icon, message, time, and a link to ask about it. */
function AlertRow({ alert, onRead }: { alert: AppAlert; onRead: (id: string) => void }) {
  const kind = KINDS[alert.kind] ?? KINDS.strategy_change;
  const question = kind.question(alert.ticker ?? "my portfolio");
  return (
    <li className={`flex gap-4 py-4 ${alert.read ? "opacity-70" : ""}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kind.tone}`}>
        <kind.Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className="font-semibold uppercase tracking-wider">{kind.label}</span>
          <span>· {timeAgo(alert.created_at)}</span>
          {!alert.read && <span className="h-2 w-2 rounded-full bg-brick-500" aria-label="Unread" />}
        </p>
        <p className="mt-1 text-[15px] text-ink-800">{alert.message}</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link href={`/chat?ask=${encodeURIComponent(question)}`} onClick={() => onRead(alert.id)} className="link">
            Ask the copilot →
          </Link>
          {!alert.read && (
            <button onClick={() => onRead(alert.id)} className="text-ink-500 transition hover:text-ink-900">
              Mark as read
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function AlertsPage() {
  useRequireAuth();
  const { alerts, unread, loaded, markRead, markAllRead } = useAlerts();

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          eyebrow="Alerts"
          title={<>What needs your <span className="italic text-gold-500">attention</span></>}
          description="Checked against your holdings and profile every time you open the app (at most every 30 minutes)."
          actions={
            unread > 0 ? (
              <button onClick={markAllRead} className="btn-secondary px-4 py-2 text-sm">Mark all as read</button>
            ) : undefined
          }
        />

        <section className="card max-w-4xl px-6 py-2">
          {!loaded ? (
            <div className="space-y-3 py-4">
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-12 text-center">
              <IconBell size={28} className="mx-auto text-gold-400" />
              <p className="mt-3 font-display text-xl text-ink-900">All quiet</p>
              <p className="mt-1 text-sm text-ink-500">
                You&apos;ll see alerts here when a position passes your limit, drops sharply, files with the SEC or
                reports earnings.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-paper-200">
              {alerts.map((a) => <AlertRow key={a.id} alert={a} onRead={markRead} />)}
            </ul>
          )}
        </section>
      </PageContainer>
    </PageLayout>
  );
}
