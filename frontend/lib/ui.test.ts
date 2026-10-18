/** Tests for the shared colour and formatting helpers in lib/ui.ts. */
import { describe, expect, it } from "vitest";
import {
  actionColor,
  concentrationBadge,
  concentrationLevel,
  formatCompactMoney,
  formatMoney,
  formatPct,
  gainColor,
  healthColor,
  shortCitation,
} from "./ui";

describe("formatMoney", () => {
  it("formats with thousands separators and two decimals", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });
  it("respects the decimals argument", () => {
    expect(formatMoney(1234.5, 0)).toBe("$1,235");
  });
  it("shows a dash for missing values instead of $0", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});

describe("formatCompactMoney", () => {
  it.each([
    [331_800_000_000, "$331.8B"],
    [2_500_000_000_000, "$2.50T"],
    [12_400_000, "$12.4M"],
    [-12_400_000, "-$12.4M"],
    [950, "$950"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatCompactMoney(value)).toBe(expected);
  });
});

describe("formatPct", () => {
  it("adds a plus sign only when signed and positive", () => {
    expect(formatPct(12.34, true)).toBe("+12.3%");
    expect(formatPct(12.34)).toBe("12.3%");
    expect(formatPct(-4, true)).toBe("-4.0%");
  });
});

describe("concentration thresholds", () => {
  it("classifies weights as High above 25%, Medium above 15%, otherwise Low", () => {
    expect(concentrationLevel(30)).toBe("High");
    expect(concentrationLevel(25)).toBe("Medium");
    expect(concentrationLevel(16)).toBe("Medium");
    expect(concentrationLevel(15)).toBe("Low");
  });
  it("uses matching badge colours", () => {
    expect(concentrationBadge(30)).toContain("brick");
    expect(concentrationBadge(20)).toContain("gold");
    expect(concentrationBadge(5)).toContain("fern");
  });
});

describe("colour helpers", () => {
  it("colours actions case-insensitively, with a neutral fallback", () => {
    expect(actionColor("BUY")).toContain("fern");
    expect(actionColor("trim")).toContain("brick");
    expect(actionColor("hold")).toContain("gold");
    expect(actionColor("rebalance")).toContain("harbor");
    expect(actionColor("unknown")).toContain("paper");
  });
  it("colours health scores by band", () => {
    expect(healthColor(80)).toContain("fern");
    expect(healthColor(55)).toContain("gold");
    expect(healthColor(20)).toContain("brick");
  });
  it("colours gains green and losses red", () => {
    expect(gainColor(0)).toContain("fern");
    expect(gainColor(-1)).toContain("brick");
  });
});

describe("shortCitation", () => {
  it("drops the ticker and fiscal year for compact chips", () => {
    expect(shortCitation("AAPL 10-K FY2025, Item 1A Risk Factors", "AAPL")).toBe("10-K · Item 1A Risk Factors");
  });
});

describe("user-specific concentration limits", () => {
  it("labels risk against the user's own thresholds", () => {
    const limits = { high: 40, medium: 24 };
    expect(concentrationLevel(30, limits)).toBe("Medium");
    expect(concentrationLevel(41, limits)).toBe("High");
    expect(concentrationBadge(30, limits)).toContain("gold");
  });
});
