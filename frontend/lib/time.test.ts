/** Tests for the freshness wording in lib/time.ts. */
import { describe, expect, it } from "vitest";
import { shortDate, timeAgo } from "./time";

const NOW = new Date("2026-10-18T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("timeAgo", () => {
  it.each([
    [10, "just now"],
    [5 * 60, "5 min ago"],
    [3 * 3600, "3 h ago"],
    [86400, "1 day ago"],
    [3 * 86400, "3 days ago"],
  ])("%d seconds ago reads %s", (seconds, expected) => {
    expect(timeAgo(ago(seconds), NOW)).toBe(expected);
  });

  it("shows the date for anything older than a week", () => {
    expect(timeAgo(ago(10 * 86400), NOW)).toBe("Oct 8");
  });

  it("never shows a negative time for clocks slightly ahead", () => {
    expect(timeAgo(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe("just now");
  });
});

describe("shortDate", () => {
  it("adds the year only for other years", () => {
    expect(shortDate("2026-03-05T12:00:00Z", NOW)).toBe("Mar 5");
    expect(shortDate("2025-03-05T12:00:00Z", NOW)).toBe("Mar 5, 2025");
  });
});
