/** Tests for the two chart cards: Concentration risk (dashboard) and Recommendation mix (Analyse Portfolio). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { holding, position } from "@/test/fixtures";
import ConcentrationCard from "./dashboard/ConcentrationCard";
import RecommendationMix from "./strategy/RecommendationMix";

describe("ConcentrationCard", () => {
  it("renders nothing when no position has a weight", () => {
    const { container } = render(<ConcentrationCard holdings={[holding({ weight_pct: null })]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels each position's risk in words, not just colour", () => {
    render(
      <ConcentrationCard
        holdings={[
          holding({ ticker: "AAPL", weight_pct: 60 }),
          holding({ ticker: "MSFT", weight_pct: 25 }),
          holding({ ticker: "JPM", weight_pct: 15 }),
        ]}
      />
    );
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Largest · AAPL")).toBeInTheDocument();
  });
});

describe("RecommendationMix", () => {
  it("renders nothing when no position can be weighted", () => {
    const { container } = render(<RecommendationMix positions={[position({ weight_pct: null })]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows how much of the portfolio the strategy asks you to act on", () => {
    render(
      <RecommendationMix
        positions={[
          position({ ticker: "AAPL", action: "hold", weight_pct: 50 }),
          position({ ticker: "MSFT", action: "trim", weight_pct: 30 }),
          position({ ticker: "GOOGL", action: "buy", weight_pct: 20 }),
        ]}
      />
    );
    // 50% appears twice: the Keep slice in the legend, and 30% + 20% "to act on" in the centre
    expect(screen.getByText("to act on")).toBeInTheDocument();
    expect(screen.getAllByText("50%")).toHaveLength(2);
    expect(screen.getByText("Reduce")).toBeInTheDocument();
  });
});
