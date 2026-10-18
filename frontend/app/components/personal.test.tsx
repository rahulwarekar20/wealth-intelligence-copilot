/**
 * Tests for the personalisation and "come back to it" features: profile form,
 * other assets, broker import, and the strategy-changes note. The API is mocked.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportHoldings from "./dashboard/ImportHoldings";
import OtherAssetsCard from "./profile/OtherAssetsCard";
import ProfileForm from "./profile/ProfileForm";
import StrategyChangesNote from "./strategy/StrategyChangesNote";

const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  listAssets: vi.fn(),
  addAsset: vi.fn(),
  deleteAsset: vi.fn(),
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ ...api, getErrorMessage: (_e: unknown, fallback: string) => fallback }));

const PROFILE = {
  risk_tolerance: "moderate",
  horizon_years: null,
  max_position_pct: 25,
  limits: { high: 25, medium: 15 },
  is_set: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProfile.mockResolvedValue(PROFILE);
  api.saveProfile.mockImplementation(async (p) => ({ ...PROFILE, ...p, is_set: true }));
  api.listAssets.mockResolvedValue({ assets: [], total: 0 });
  api.addAsset.mockResolvedValue({});
});

describe("ProfileForm", () => {
  it("explains that defaults are in use until the profile is saved", async () => {
    render(<ProfileForm />);
    expect(await screen.findByText(/haven't set a profile yet/i)).toBeInTheDocument();
  });

  it("saves the chosen risk level and horizon", async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);
    await screen.findByText(/haven't set a profile yet/i);
    await user.click(screen.getByText("Conservative"));
    await user.type(screen.getByPlaceholderText("e.g. 15"), "12");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(api.saveProfile).toHaveBeenCalledWith({ risk_tolerance: "conservative", horizon_years: 12, max_position_pct: 25 });
    expect(await screen.findByText(/next analysis will use this profile/i)).toBeInTheDocument();
  });

  it("rejects a horizon that isn't a whole number of years", async () => {
    const user = userEvent.setup();
    render(<ProfileForm />);
    await screen.findByText(/haven't set a profile yet/i);
    await user.type(screen.getByPlaceholderText("e.g. 15"), "2.5");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText(/whole number of years/i)).toBeInTheDocument();
    expect(api.saveProfile).not.toHaveBeenCalled();
  });

  it("explains what the position limit means for the risk labels", async () => {
    render(<ProfileForm />);
    expect(await screen.findByText(/above 25% are flagged High risk; above 15% Medium/)).toBeInTheDocument();
  });
});

describe("OtherAssetsCard", () => {
  it("adds an asset, accepting values typed with $ and commas", async () => {
    const user = userEvent.setup();
    render(<OtherAssetsCard />);
    await user.type(screen.getByPlaceholderText(/name/i), "Emergency fund");
    await user.type(screen.getByPlaceholderText("Value ($)"), "$20,000");
    await user.click(screen.getByRole("button", { name: /add asset/i }));
    expect(api.addAsset).toHaveBeenCalledWith({ name: "Emergency fund", asset_class: "cash", value: 20000 });
  });

  it("requires a name and a value", async () => {
    const user = userEvent.setup();
    render(<OtherAssetsCard />);
    await user.click(screen.getByRole("button", { name: /add asset/i }));
    expect(screen.getByText(/give the asset a name/i)).toBeInTheDocument();
    expect(api.addAsset).not.toHaveBeenCalled();
  });

  it("lists assets with their total", async () => {
    api.listAssets.mockResolvedValue({ assets: [{ id: "1", name: "Flat", asset_class: "property", value: 300000 }], total: 300000 });
    render(<OtherAssetsCard />);
    expect(await screen.findByText("Flat")).toBeInTheDocument();
    expect(screen.getAllByText("$300,000")).toHaveLength(2); // total + row
  });
});

describe("ImportHoldings", () => {
  const ROWS = [
    { ticker: "NVDA", quantity: 12, cost_basis: 95, account_type: "taxable" },
    { ticker: "VTI", quantity: 40, cost_basis: null, account_type: "roth_ira" },
  ];

  async function upload(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, new File(["csv"], "positions.csv", { type: "text/csv" }));
  }

  it("previews the file and imports only the ticked rows", async () => {
    api.previewImport.mockResolvedValue({ holdings: ROWS, method: "csv" });
    api.confirmImport.mockResolvedValue({ imported: 1 });
    const onImported = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<ImportHoldings onImported={onImported} onClose={onClose} />);

    await upload(user, container);
    expect(await screen.findByText("Found 2 holdings.")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Import VTI"));
    await user.click(screen.getByRole("button", { name: "Import 1 holding" }));

    expect(api.confirmImport).toHaveBeenCalledWith([ROWS[0]], false);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("warns that AI-read statements need checking", async () => {
    api.previewImport.mockResolvedValue({ holdings: ROWS, method: "ai" });
    const user = userEvent.setup();
    const { container } = render(<ImportHoldings onImported={vi.fn()} onClose={vi.fn()} />);
    await upload(user, container);
    expect(await screen.findByText(/read by the AI, so please check each row/i)).toBeInTheDocument();
  });

  it("asks for confirmation before replacing all holdings", async () => {
    api.previewImport.mockResolvedValue({ holdings: ROWS, method: "csv" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const { container } = render(<ImportHoldings onImported={vi.fn()} onClose={vi.fn()} />);
    await upload(user, container);
    await screen.findByText("Found 2 holdings.");
    await user.click(screen.getByLabelText(/replace my current holdings/i));
    await user.click(screen.getByRole("button", { name: "Import 2 holdings" }));
    expect(confirm).toHaveBeenCalled();
    expect(api.confirmImport).not.toHaveBeenCalled();
  });

  it("shows the server's error for unreadable files", async () => {
    api.previewImport.mockRejectedValue(new Error("400"));
    const user = userEvent.setup();
    const { container } = render(<ImportHoldings onImported={vi.fn()} onClose={vi.fn()} />);
    await upload(user, container);
    expect(await screen.findByText("Could not read this file.")).toBeInTheDocument();
  });
});

describe("StrategyChangesNote", () => {
  it("renders nothing for a first analysis", () => {
    const { container } = render(<StrategyChangesNote changes={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists changed calls and the health-score move", () => {
    render(
      <StrategyChangesNote
        changes={{
          previous_at: null,
          health_before: 55,
          health_after: 60,
          changes: [{ ticker: "GOOGL", before: "trim", after: "hold" }],
          added: ["NVDA"],
          removed: [],
        }}
      />
    );
    expect(screen.getByText("GOOGL")).toBeInTheDocument();
    expect(screen.getByText("HOLD")).toBeInTheDocument();
    expect(screen.getByText(/New in the analysis: NVDA/)).toBeInTheDocument();
    expect(screen.getByText(/Health score 55/)).toBeInTheDocument();
  });

  it("says so when nothing changed", () => {
    render(
      <StrategyChangesNote
        changes={{ previous_at: null, health_before: 60, health_after: 60, changes: [], added: [], removed: [] }}
      />
    );
    expect(screen.getByText(/No changes since your last analysis/)).toBeInTheDocument();
  });
});
