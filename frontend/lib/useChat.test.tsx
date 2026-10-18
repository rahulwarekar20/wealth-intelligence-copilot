/** Tests for the chat hook's failure handling: friendly errors and one-tap retry. */
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recommendation } from "@/test/fixtures";
import { clearSessionStore } from "./sessionStore";
import { useChat } from "./useChat";

const askCopilot = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({
  askCopilot,
  getErrorMessage: (_e: unknown, fallback = "The AI service is busy.") => fallback,
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clearSessionStore();
});

describe("useChat failures", () => {
  it("marks a failed answer as retryable with the original question", async () => {
    askCopilot.mockRejectedValue(new Error("busy"));
    const { result } = renderHook(() => useChat());
    await act(() => result.current.ask("Should I buy Apple?"));
    const last = result.current.messages.at(-1)!;
    expect(last.retry).toBe("Should I buy Apple?");
    expect(last.content).toBe("The AI service is busy.");
  });

  it("explains a lost connection instead of blaming the backend", async () => {
    askCopilot.mockRejectedValue(new AxiosError("Network Error")); // no response = never reached the server
    const { result } = renderHook(() => useChat());
    await act(() => result.current.ask("Should I buy Apple?"));
    expect(result.current.messages.at(-1)!.content).toMatch(/connection to the server was lost/i);
  });

  it("retrying replaces the failed attempt rather than repeating it", async () => {
    askCopilot.mockRejectedValueOnce(new Error("busy"));
    askCopilot.mockResolvedValueOnce({ route: "recommendation", ...recommendation({ ticker: "AAPL" }) });
    const { result } = renderHook(() => useChat());

    await act(() => result.current.ask("Should I buy Apple?"));
    await act(() => result.current.ask("Should I buy Apple?", true));

    await waitFor(() => expect(result.current.messages.at(-1)!.answer).toBeDefined());
    const userTurns = result.current.messages.filter((m) => m.role === "user");
    expect(userTurns).toHaveLength(1);
    expect(result.current.messages.some((m) => m.retry && !m.pending)).toBe(false);
    // The failed attempt is not sent to the backend as conversation history
    expect(askCopilot).toHaveBeenLastCalledWith("Should I buy Apple?", []);
  });
});
