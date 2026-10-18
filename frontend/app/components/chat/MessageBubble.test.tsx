/** Tests for chat messages: plain text, structured answers, waiting and interrupted states. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
