/** Tests for the add-holding form: validation, submission and error display. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AddHoldingForm from "./AddHoldingForm";

function setup(onAdd = vi.fn().mockResolvedValue(undefined)) {
  render(<AddHoldingForm onAdd={onAdd} />);
  const user = userEvent.setup();
  return {
    onAdd,
    user,
    ticker: screen.getByPlaceholderText("Ticker"),
    quantity: screen.getByPlaceholderText("Quantity"),
    cost: screen.getByPlaceholderText("Cost / share"),
    submit: screen.getByRole("button", { name: /add holding/i }),
  };
}

describe("AddHoldingForm", () => {
  it("submits a valid holding with the ticker upper-cased", async () => {
    const { user, onAdd, ticker, quantity, cost, submit } = setup();
    await user.type(ticker, "msft");
    await user.type(quantity, "12.5");
    await user.type(cost, "300");
    await user.selectOptions(screen.getByRole("combobox"), "roth_ira");
    await user.click(submit);
    expect(onAdd).toHaveBeenCalledWith({ ticker: "MSFT", quantity: 12.5, cost_basis: 300, account_type: "roth_ira" });
  });

  it("treats an empty cost basis as unknown, not zero", async () => {
    const { user, onAdd, ticker, quantity, submit } = setup();
    await user.type(ticker, "AAPL");
    await user.type(quantity, "1");
    await user.click(submit);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ cost_basis: null }));
  });

  it("clears the form after a successful add", async () => {
    const { user, ticker, quantity, submit } = setup();
    await user.type(ticker, "AAPL");
    await user.type(quantity, "1");
    await user.click(submit);
    expect(ticker).toHaveValue("");
    expect(quantity).toHaveValue("");
  });

  it.each([
    ["", "5", "Enter a ticker."],
    ["AAPL", "0", "Quantity must be greater than 0."],
    ["AAPL", "abc", "Quantity must be greater than 0."],
  ])("rejects ticker=%j quantity=%j without calling the API", async (t, q, message) => {
    const { user, onAdd, ticker, quantity, submit } = setup();
    if (t) await user.type(ticker, t);
    await user.type(quantity, q);
    await user.click(submit);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("rejects a negative cost basis", async () => {
    const { user, onAdd, ticker, quantity, cost, submit } = setup();
    await user.type(ticker, "AAPL");
    await user.type(quantity, "1");
    await user.type(cost, "-5");
    await user.click(submit);
    expect(screen.getByText("Cost basis must be 0 or more.")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows the error when the server rejects the holding, and keeps the input", async () => {
    const { user, ticker, quantity, submit } = setup(vi.fn().mockRejectedValue(new Error("boom")));
    await user.type(ticker, "AAPL");
    await user.type(quantity, "1");
    await user.click(submit);
    expect(await screen.findByText("Could not add holding.")).toBeInTheDocument();
    expect(ticker).toHaveValue("AAPL");
  });
});
