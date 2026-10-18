/** Tests for the dashboard strategy panel in each of its states. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { strategy } from "@/test/fixtures";
import StrategyPanel from "./StrategyPanel";

const base = { strategy: null, running: false, error: "", hasHoldings: true, onRun: vi.fn() };

describe("StrategyPanel", () => {
  it("asks for holdings when the portfolio is empty, with Analyse disabled", () => {
    render(<StrategyPanel {...base} hasHoldings={false} />);
    expect(screen.getByText(/add a holding/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyse/i })).toBeDisabled();
  });

  it("shows a progress message while running", () => {
    render(<StrategyPanel {...base} running />);
    expect(screen.getByText(/reading filings, prices and news/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analysing/i })).toBeDisabled();
  });

  it("shows the error message when the analysis failed", () => {
    render(<StrategyPanel {...base} error="LLM unavailable" />);
    expect(screen.getByText("LLM unavailable")).toBeInTheDocument();
  });

  it("shows the summary, each position's action and the priority actions when done", () => {
    render(<StrategyPanel {...base} strategy={strategy()} />);
    expect(screen.getByText("Healthy but concentrated in tech.")).toBeInTheDocument();
    expect(screen.getAllByText("trim").length).toBeGreaterThanOrEqual(2); // position + priority action
    expect(screen.getByText("Reduce below 25%.")).toBeInTheDocument();
  });

  it("re-runs the analysis when Refresh is clicked", async () => {
    const onRun = vi.fn();
    render(<StrategyPanel {...base} strategy={strategy()} onRun={onRun} />);
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });
});
