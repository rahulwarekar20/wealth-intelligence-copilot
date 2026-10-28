/** Tests for the answer card's evidence checks: unverified citations, confidence notes, signal summary. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { recommendation } from "@/test/fixtures";
import RecommendationCard from "./RecommendationCard";

const ASSESSMENT = {
  direction: -1, direction_label: "negative" as const, agreement: 1, coverage: 1,
  signals_available: 3, signals_requested: 3, missing: [],
};

describe("RecommendationCard evidence checks", () => {
  it("marks citations the backend could not verify, with the reason on hover", () => {
    render(
      <RecommendationCard
        rec={recommendation({
          ticker: "MSFT",
          key_points: [
            { point: "Antitrust scrutiny", citation: "MSFT 10-K FY2026, Item 1A Risk Factors", citation_verified: true },
            { point: "Margins fell", citation: "MSFT 10-K FY2026, Item 7 MD&A", citation_verified: false,
              citation_issue: "cites a 10-K section that was not retrieved" },
          ],
        })}
      />
    );
    const bad = screen.getByText(/unverified · 10-K · Item 7 MD&A/);
    expect(bad).toHaveAttribute("title", "Unverified: cites a 10-K section that was not retrieved");
    expect(screen.getByText("10-K · Item 1A Risk Factors")).toBeInTheDocument();
  });

  it("explains why confidence was capped", () => {
    render(<RecommendationCard rec={recommendation({ confidence_notes: ["Based on 2 of 3 specialist signals (missing: evidence agent)."] })} />);
    expect(screen.getByText(/Based on 2 of 3 specialist signals/)).toBeInTheDocument();
  });

  it("summarises agreement, direction, coverage and citations separately", () => {
    render(
      <RecommendationCard
        rec={recommendation({
          signal_assessment: ASSESSMENT,
          citation_check: { verified: 3, cited: 4, evidence_signals_withheld: 0 },
        })}
      />
    );
    expect(screen.getByText("Signals: 3 of 3 specialists · agree · lean negative · 3 of 4 citations verified")).toBeInTheDocument();
  });

  it("says agreement is not assessable with a single signal", () => {
    render(
      <RecommendationCard
        rec={recommendation({
          signal_assessment: { ...ASSESSMENT, agreement: null, signals_available: 1, direction_label: "neutral" },
        })}
      />
    );
    expect(screen.getByText(/1 of 3 specialists · agreement n\/a · lean neutral/)).toBeInTheDocument();
  });
});
