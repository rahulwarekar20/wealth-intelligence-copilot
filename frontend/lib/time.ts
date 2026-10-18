/**
 * Date and time wording for freshness labels ("Prices as of 2:41 pm",
 * "Analysed 3 min ago") and lists ("Oct 18"). `now` can be passed in for tests.
 */

/** "just now", "5 min ago", "3 h ago", "2 days ago", or the date for anything older than a week. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return shortDate(iso);
}

/** "2:41 pm" in the viewer's time zone. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/** "Oct 18" (adds the year when it isn't the current one). */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}
