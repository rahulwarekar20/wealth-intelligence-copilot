/** Tests for turning copilot answers into conversation history (lib/chatSession.ts). */
import { describe, expect, it } from "vitest";
import { recommendation, strategy } from "@/test/fixtures";
import { answerToText, toHistory } from "./chatSession";

describe("toHistory", () => {
  it("keeps only the last `limit` non-empty turns", () => {
    const turns = [
      { role: "user" as const, content: "one" },
      { role: "assistant" as const, content: "" },
      { role: "assistant" as const, content: "two" },
      { role: "user" as const, content: "three" },
    ];
    expect(toHistory(turns, 2).map((t) => t.content)).toEqual(["two", "three"]);
  });

  it("truncates very long messages to what the API accepts", () => {
    const [turn] = toHistory([{ role: "assistant", content: "x".repeat(5000) }], 5);
    expect(turn.content.length).toBe(2000);
  });
});

describe("answerToText", () => {
  it("includes the ticker so follow-ups like 'should I sell it?' resolve", () => {
    const text = answerToText({ route: "recommendation", ...recommendation({ ticker: "MSFT", action: "trim", summary: "Too large." }) });
    expect(text).toBe("[MSFT] TRIM — Too large.");
  });

  it("lists every stock in a comparison", () => {
    const text = answerToText({
      route: "comparison",
      results: [recommendation({ ticker: "AAPL" }), recommendation({ ticker: "GOOGL", action: "buy" })],
    });
    expect(text).toContain("[AAPL]");
    expect(text).toContain("[GOOGL] BUY");
  });

  it("summarises a strategy with its score and per-position actions", () => {
    const text = answerToText({ route: "strategy", ...strategy() });
    expect(text).toContain("72/100");
    expect(text).toContain("MSFT: trim");
  });

  it("keeps the retirement follow-up question so it isn't asked twice", () => {
    const text = answerToText({
      route: "retirement",
      answer: "You are on track.",
      action_items: ["Save more"],
      follow_up_question: "What is your age?",
      confidence: "medium",
      disclaimer: "",
      total_portfolio_value: 1000,
    });
    expect(text).toContain("Actions: Save more");
    expect(text).toContain("Question for user: What is your age?");
  });
});
