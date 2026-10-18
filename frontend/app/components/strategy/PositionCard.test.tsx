/** Tests for a position card on Analyse Portfolio. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { position } from "@/test/fixtures";
import PositionCard from "./PositionCard";

describe("PositionCard", () => {
  it("shows the action, price, return vs cost and reasoning", () => {
    render(<PositionCard position={position({ ticker: "SPY", action: "trim", current_price: 763.25, gain_loss_pct: 90.81, reasoning: "Over half the portfolio." })} />);
    expect(screen.getByText("SPY")).toBeInTheDocument();
    expect(screen.getByText("trim")).toBeInTheDocument();
    expect(screen.getByText("$763.25")).toBeInTheDocument();
    expect(screen.getByText(/\+90\.81% vs cost/)).toBeInTheDocument();
    expect(screen.getByText("Over half the portfolio.")).toBeInTheDocument();
  });

  it.each(["HIGH", "medium", "LOW"])("labels a known concentration level (%s)", (flag) => {
    render(<PositionCard position={position({ concentration_flag: flag })} />);
    expect(screen.getByText(`${flag.toLowerCase()} concentration`)).toBeInTheDocument();
  });

  it("hides concentration values the AI made up, such as NONE", () => {
    render(<PositionCard position={position({ concentration_flag: "NONE" })} />);
    expect(screen.queryByText(/concentration/i)).not.toBeInTheDocument();
  });

  it("shows the key risk and opportunity when present", () => {
    render(<PositionCard position={position({ key_risk: "Rate risk", key_opportunity: "Margin growth" })} />);
    expect(screen.getByText("Rate risk")).toBeInTheDocument();
    expect(screen.getByText("Margin growth")).toBeInTheDocument();
  });
});
