/**
 * App shell for signed-in pages: navigation (a sidebar on large screens, a top
 * bar with a menu on phones) and the page content.
 *
 * Pages wrap their content in <PageLayout> and then <PageContainer>, which
 * gives every screen the same full-width body with consistent side margins.
 */
import Sidebar, { SIDEBAR_WIDTH_CLASS } from "./Sidebar";

/** Sidebar + main area. Use once per signed-in page. */
export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className={`${SIDEBAR_WIDTH_CLASS} min-w-0`}>{children}</main>
    </div>
  );
}

/**
 * Full-width page body with the standard side and vertical padding.
 * Content stretches edge to edge on normal screens and stops widening on
 * very large monitors, where long lines would get hard to read.
 */
export function PageContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full max-w-[1760px] px-4 py-6 sm:px-8 sm:py-10 xl:px-12 ${className}`}>{children}</div>;
}
