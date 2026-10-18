/** Tests for the Alerts and Track record pages (API and router mocked). */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlertsPage from "./alerts/page";
import TrackRecordPage from "./track-record/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/alerts", useRouter: () => ({ replace: vi.fn() }) }));

const api = vi.hoisted(() => ({
  getAlerts: vi.fn(),
  markAlertsRead: vi.fn(),
  getTrackRecord: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  ...api,
  getToken: () => "token",
  logout: vi.fn(),
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.markAlertsRead.mockResolvedValue(undefined);
  api.getAlerts.mockResolvedValue({
    alerts: [
      { id: "a1", kind: "concentration", ticker: "SPY", message: "SPY is 51.3% of your portfolio.", created_at: new Date().toISOString(), read: false },
      { id: "a2", kind: "earnings", ticker: "MSFT", message: "MSFT reports earnings on Wed Oct 28.", created_at: new Date().toISOString(), read: true },
    ],
    unread: 1,
  });
});

describe("Alerts page", () => {
  it("lists alerts with a ready-made question for the copilot", async () => {
    render(<AlertsPage />);
    expect(await screen.findByText("SPY is 51.3% of your portfolio.")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /ask the copilot/i });
    expect(links[0]).toHaveAttribute("href", `/chat?ask=${encodeURIComponent("Should I trim my SPY position?")}`);
  });

  it("marks everything read and clears the unread count", async () => {
    render(<AlertsPage />);
    await screen.findByText("SPY is 51.3% of your portfolio.");
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(api.markAlertsRead).toHaveBeenCalledWith();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument();
  });
});

describe("Track record page", () => {
  it("summarises verdicts and labels each call in words", async () => {
    api.getTrackRecord.mockResolvedValue([
      { ticker: "AAPL", action: "buy", source: "Should I buy Apple?", made_at: "2026-10-11T12:00:00Z", price_then: 100, price_now: 110, change_pct: 10, verdict: "on_track" },
      { ticker: "MSFT", action: "trim", source: "Portfolio strategy", made_at: "2026-10-11T12:00:00Z", price_then: 100, price_now: 105, change_pct: 5, verdict: "against" },
      { ticker: "SPY", action: "hold", source: "Portfolio strategy", made_at: "2026-10-18T12:00:00Z", price_then: 700, price_now: 700, change_pct: 0, verdict: "too_early" },
    ]);
    render(<TrackRecordPage />);
    expect(await screen.findByText("1 of 2")).toBeInTheDocument(); // on track, of calls with a direction
    const row = screen.getByText("MSFT").closest("tr")!;
    expect(within(row).getByText("Against the call")).toBeInTheDocument();
    expect(within(row).getByText("+5.0%")).toBeInTheDocument();
  });

  it("explains an empty record", async () => {
    api.getTrackRecord.mockResolvedValue([]);
    render(<TrackRecordPage />);
    expect(await screen.findByText("No calls yet")).toBeInTheDocument();
  });
});
