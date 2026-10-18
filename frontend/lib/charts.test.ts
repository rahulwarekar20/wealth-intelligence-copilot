/** Tests for the donut-chart data helpers in lib/charts.ts. */
import { describe, expect, it } from "vitest";
import { holding, position } from "@/test/fixtures";
import { MAX_SLICES, OTHER_COLOR, SERIES_COLORS, allocationSlices, recommendationSlices, tickerColors } from "./charts";

describe("allocationSlices", () => {
  it("returns one slice per ticker, largest first", () => {
    const slices = allocationSlices([
      holding({ ticker: "MSFT", weight_pct: 30 }),
      holding({ ticker: "AAPL", weight_pct: 70 }),
    ]);
    expect(slices.map((s) => [s.label, s.value])).toEqual([["AAPL", 70], ["MSFT", 30]]);
  });

  it("merges a ticker held in several accounts", () => {
    const slices = allocationSlices([
      holding({ id: "1", ticker: "AAPL", weight_pct: 20, account_type: "taxable" }),
      holding({ id: "2", ticker: "AAPL", weight_pct: 15, account_type: "ira" }),
      holding({ id: "3", ticker: "SPY", weight_pct: 65 }),
    ]);
    expect(slices.find((s) => s.label === "AAPL")?.value).toBe(35);
    expect(slices).toHaveLength(2);
  });

  it("skips positions without a live price", () => {
    const slices = allocationSlices([holding({ ticker: "AAPL", weight_pct: 100 }), holding({ ticker: "XYZ", weight_pct: null })]);
    expect(slices.map((s) => s.label)).toEqual(["AAPL"]);
  });

  it("folds the smallest positions into 'Other' beyond the slice limit", () => {
    const tickers = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const slices = allocationSlices(tickers.map((t, i) => holding({ ticker: t, weight_pct: 20 - i })));
    expect(slices).toHaveLength(MAX_SLICES);
    const other = slices[slices.length - 1];
    expect(other.label).toBe("Other");
    expect(other.color).toBe(OTHER_COLOR);
    expect(other.detail).toBe("F, G, H");
    expect(other.value).toBe(15 + 14 + 13);
  });

  it("keeps a ticker's colour when weights change (colour follows the ticker, not its rank)", () => {
    const before = allocationSlices([holding({ ticker: "AAPL", weight_pct: 60 }), holding({ ticker: "MSFT", weight_pct: 40 })]);
    const after = allocationSlices([holding({ ticker: "AAPL", weight_pct: 30 }), holding({ ticker: "MSFT", weight_pct: 70 })]);
    const color = (slices: typeof before, t: string) => slices.find((s) => s.label === t)?.color;
    expect(color(before, "AAPL")).toBe(color(after, "AAPL"));
    expect(color(before, "MSFT")).toBe(color(after, "MSFT"));
  });
});

describe("tickerColors", () => {
  it("assigns palette colours alphabetically without repeating", () => {
    expect(tickerColors(["MSFT", "AAPL"])).toEqual({ AAPL: SERIES_COLORS[0], MSFT: SERIES_COLORS[1] });
  });
});

describe("recommendationSlices", () => {
  it("groups position weights into Add / Keep / Reduce / Rebalance", () => {
    const slices = recommendationSlices([
      position({ ticker: "GOOGL", action: "buy", weight_pct: 15 }),
      position({ ticker: "AAPL", action: "HOLD", weight_pct: 40 }),
      position({ ticker: "MSFT", action: "trim", weight_pct: 25 }),
      position({ ticker: "JPM", action: "sell", weight_pct: 20 }),
    ]);
    expect(slices.map((s) => [s.label, s.value, s.detail])).toEqual([
      ["Add", 15, "GOOGL"],
      ["Keep", 40, "AAPL"],
      ["Reduce", 45, "MSFT, JPM"],
    ]);
  });

  it("ignores positions without a weight or with an unknown action", () => {
    const slices = recommendationSlices([
      position({ action: "hold", weight_pct: null }),
      position({ action: "wait", weight_pct: 30 }),
    ]);
    expect(slices).toEqual([]);
  });
});
