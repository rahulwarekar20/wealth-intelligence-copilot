/** Tests for chat messages: plain text, structured answers, waiting and interrupted states. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { recommendation } from "@/test/fixtures";
import MessageBubble from "./MessageBubble";

describe("MessageBubble", () => {
  it("shows a user question as text", () => {
    render(<MessageBubble message={{ role: "user", content: "Should I buy Apple?" }} interrupted={false} />);
    expect(screen.getByText("Should I buy Apple?")).toBeInTheDocument();
  });

  it("renders a structured stock answer as a recommendation card", () => {
    const answer = { route: "recommendation" as const, ...recommendation({ ticker: "MSFT", action: "trim", answer: "Trim toward 20%." }) };
    render(<MessageBubble message={{ role: "assistant", content: "", answer }} interrupted={false} />);
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("Trim toward 20%.")).toBeInTheDocument();
  });

  it("shows the waiting indicator while an answer is pending", () => {
    render(<MessageBubble message={{ role: "assistant", content: "", pending: true }} interrupted={false} />);
    expect(screen.getByText(/analysing/i)).toBeInTheDocument();
  });

  it("explains when a pending answer was lost to a page reload", () => {
    render(<MessageBubble message={{ role: "assistant", content: "", pending: true }} interrupted />);
    expect(screen.getByText(/interrupted because the page reloaded/i)).toBeInTheDocument();
  });
});

describe("MessageBubble retry", () => {
  it("offers Try again on a failed answer and passes the question back", async () => {
    const onRetry = vi.fn();
    render(<MessageBubble message={{ role: "assistant", content: "The AI service is busy.", retry: "Should I buy Apple?" }} interrupted={false} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledWith("Should I buy Apple?");
  });

  it("offers Try again after an interrupted answer", () => {
    render(<MessageBubble message={{ role: "assistant", content: "", pending: true, retry: "Q" }} interrupted onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("hides Try again when retrying isn't allowed (older messages)", () => {
    render(<MessageBubble message={{ role: "assistant", content: "Error", retry: "Q" }} interrupted={false} />);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
