/**
 * Placeholder shapes shown while the portfolio loads, laid out like the real
 * dashboard so the page doesn't jump when data arrives.
 */
export default function DashboardSkeleton() {
  return (
    <>
      <div className="skeleton mb-3 h-4 w-40" />
      <div className="skeleton mb-10 h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="skeleton h-48" />
        <div className="skeleton h-48" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-80" />
        <div className="skeleton h-80" />
      </div>
    </>
  );
}
