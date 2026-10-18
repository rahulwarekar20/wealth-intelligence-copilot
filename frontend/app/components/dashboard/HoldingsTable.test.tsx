/** Tests for the holdings table: values, missing prices, account tags and removal. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { holding } from "@/test/fixtures";
import HoldingsTable from "./HoldingsTable";

describe("HoldingsTable", () => {
  it("shows an empty-state message when there are no holdings", () => {
    render(<HoldingsTable holdings={[]} onRemove={vi.fn()} />);
    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
  });

  it("renders a row per holding with price, value, return and weight", () => {
    render(<HoldingsTable holdings={[holding({ ticker: "AAPL", current_price: 231.4, current_value: 27768, gain_loss_pct: 59.4, weight_pct: 26 })]} onRemove={vi.fn()} />);
    const row = screen.getByText("AAPL").closest("tr")!;
    expect(within(row).getByText("$231.40")).toBeInTheDocument();
    expect(within(row).getByText("$27,768")).toBeInTheDocument();
    expect(within(row).getByText("+59.4%")).toBeInTheDocument();
    expect(within(row).getByText("26%")).toBeInTheDocument();
  });

  it("shows dashes rather than $0 when a live price is unavailable", () => {
    render(<HoldingsTable holdings={[holding({ ticker: "XYZ", current_price: null, current_value: null, weight_pct: null, gain_loss_pct: null })]} onRemove={vi.fn()} />);
    const row = screen.getByText("XYZ").closest("tr")!;
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(within(row).getByText("n/a")).toBeInTheDocument();
  });

  it("tags non-taxable accounts", () => {
    render(<HoldingsTable holdings={[holding({ account_type: "roth_ira" })]} onRemove={vi.fn()} />);
    expect(screen.getByText("Roth")).toBeInTheDocument();
  });

  it("calls onRemove with the holding when its remove button is clicked", async () => {
    const onRemove = vi.fn();
    const h = holding({ ticker: "MSFT" });
    render(<HoldingsTable holdings={[h]} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove MSFT" }));
    expect(onRemove).toHaveBeenCalledWith(h);
  });
});
