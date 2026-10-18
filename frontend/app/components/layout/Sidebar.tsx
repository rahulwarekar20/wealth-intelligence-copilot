"use client";

/**
 * Navigation for signed-in pages.
 *
 * - Large screens (lg and up): a fixed sidebar on the left.
 * - Phones and tablets: a top bar with the logo, an alerts bell and a menu
 *   button that slides the same navigation in as a drawer.
 *
 * To add a page to the navigation, add an entry to NAV_ITEMS.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/api";
import { useAlerts } from "@/lib/useAlerts";
import { LogoMark, Wordmark } from "../brand/Logo";
import {
  IconBell,
  IconChat,
  IconClose,
  IconCompass,
  IconDocument,
  IconHistory,
  IconLedger,
  IconLogout,
  IconMenu,
  IconUser,
} from "../ui/Icons";

/** Left margin that matches the sidebar width on large screens; PageLayout applies it. */
export const SIDEBAR_WIDTH_CLASS = "lg:ml-64";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconLedger },
  { href: "/strategy", label: "Analyse Portfolio", Icon: IconCompass },
  { href: "/chat", label: "Ask Copilot", Icon: IconChat },
  { href: "/track-record", label: "Track record", Icon: IconHistory },
  { href: "/alerts", label: "Alerts", Icon: IconBell, badge: true },
  { href: "/upload", label: "Documents", Icon: IconDocument },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

/** Small count bubble for unread alerts (hidden when zero). */
function Badge({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={`min-w-5 rounded-full bg-brick-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Logo, links and sign-out; shared by the desktop sidebar and the mobile drawer. */
function NavContent({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <>
      <Link href="/dashboard" className="hidden px-5 pb-5 pt-6 lg:block">
        <Wordmark size={38} stacked />
      </Link>
      <div className="ornament mx-5 mb-4 hidden text-[8px] lg:flex">◆</div>

      {/* Navigation — the current page is highlighted */}
      <nav className="flex-1 space-y-1 px-3 pt-4 lg:pt-0">
        <p className="eyebrow px-3 pb-2">Workspace</p>
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active ? "bg-ink-900 text-paper-50 shadow-card" : "text-ink-600 hover:bg-paper-200 hover:text-ink-900"
              }`}
            >
              <Icon className={active ? "text-gold-300" : "text-ink-500 group-hover:text-ink-800"} />
              <span className="flex-1">{label}</span>
              {badge && <Badge count={unread} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer: disclaimer and sign-out */}
      <div className="space-y-3 border-t border-paper-300 px-3 py-4">
        <p className="px-3 text-[11px] leading-snug text-ink-500">
          Informational only. Not personalised investment advice.
        </p>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 transition-all hover:bg-brick-50 hover:text-brick-600"
        >
          <IconLogout />
          Sign out
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { unread } = useAlerts();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the drawer is a response to the route change
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col overflow-y-auto border-r border-paper-300 bg-paper-50/80 backdrop-blur-sm lg:flex">
        <NavContent unread={unread} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-paper-300 bg-paper-50/90 px-4 py-3 backdrop-blur-sm lg:hidden">
        <Link href="/dashboard"><Wordmark size={30} /></Link>
        <div className="flex items-center gap-1">
          <Link href="/alerts" aria-label={`Alerts (${unread} unread)`} className="relative rounded-lg p-2 text-ink-700 hover:bg-paper-200">
            <IconBell size={20} />
            <Badge count={unread} className="absolute -right-0.5 -top-0.5" />
          </Link>
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="rounded-lg p-2 text-ink-700 hover:bg-paper-200">
            <IconMenu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-900/40" />
          <aside className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto overflow-x-hidden bg-paper-50 shadow-book">
            <div className="flex items-center justify-between border-b border-paper-300 px-4 py-3">
              <LogoMark size={30} />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-ink-700 hover:bg-paper-200">
                <IconClose size={20} />
              </button>
            </div>
            <NavContent unread={unread} />
          </aside>
        </div>
      )}
    </>
  );
}
