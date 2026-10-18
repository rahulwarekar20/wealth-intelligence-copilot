/** Tests for the donut chart: legend values, hover/focus behaviour and accessibility. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Slice } from "@/lib/charts";
import DonutChart from "./DonutChart";

const SLICES: Slice[] = [
  { key: "AAPL", label: "AAPL", value: 60, color: "#2f6fa3" },
  { key: "MSFT", label: "MSFT", value: 40, color: "#c8912f", detail: "two accounts" },
];

function renderChart(slices = SLICES) {
  return render(<DonutChart slices={slices} title="Weight by position" centerLabel="Largest" centerValue="60%" />);
}

describe("DonutChart", () => {
  it("has an accessible name and a labelled segment per slice", () => {
    renderChart();
    expect(screen.getByRole("img", { name: "Weight by position" })).toBeInTheDocument();
    expect(screen.getByLabelText("AAPL: 60%")).toBeInTheDocument();
    expect(screen.getByLabelText("MSFT: 40%")).toBeInTheDocument();
  });

  it("lists every value in the legend, so nothing depends on colour alone", () => {
    renderChart();
    expect(screen.getByRole("list")).toHaveTextContent("AAPL");
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("two accounts")).toBeInTheDocument();
  });

  it("shows the default headline in the centre", () => {
    renderChart();
    expect(screen.getByText("Largest")).toBeInTheDocument();
  });

  it("shows the hovered slice in the centre, and restores the headline on leave", () => {
    renderChart();
    const segment = screen.getByLabelText("MSFT: 40%");
    fireEvent.mouseEnter(segment);
    expect(screen.getAllByText("MSFT").length).toBe(2); // legend + centre
    fireEvent.mouseLeave(segment);
    expect(screen.getByText("Largest")).toBeInTheDocument();
  });

  it("supports keyboard focus on segments", () => {
    renderChart();
    fireEvent.focus(screen.getByLabelText("AAPL: 60%"));
    expect(screen.queryByText("Largest")).not.toBeInTheDocument();
  });

  it("draws a single slice as a full ring", () => {
    const { container } = renderChart([{ key: "SPY", label: "SPY", value: 100, color: "#2f6fa3" }]);
    expect(container.querySelectorAll("circle[aria-label='SPY: 100%']")).toHaveLength(1);
  });
});
