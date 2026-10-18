/**
 * useStrategy: the AI portfolio strategy, shared by the Dashboard and the
 * Analyse Portfolio page.
 *
 * The request lives here at module level, so it keeps running when you switch
 * screens and is never started twice; the result is kept for the browser session.
 */
import { useCallback } from "react";
import { getErrorMessage, getPortfolioStrategy } from "./api";
import { removeSessionValue, useSessionState } from "./sessionStore";
import type { PortfolioStrategy } from "./types";

type Status = { state: "idle" | "running" | "error"; message?: string };

const STRATEGY_KEY = "strategy";
const STATUS_KEY = "strategy_status";
const NO_STRATEGY: PortfolioStrategy | null = null;
const IDLE: Status = { state: "idle" };

let inFlight: Promise<void> | null = null;
let requestActive = false; // set before status changes, so renders never see "running" without it

/** Forgets the saved strategy (e.g. after holdings change), so the next visit re-runs it. */
export function clearStrategyCache() {
  removeSessionValue(STRATEGY_KEY);
  removeSessionValue(STATUS_KEY);
}

/** The shared strategy: { strategy, running, error, run, clear }. */
export function useStrategy() {
  const [strategy, setStrategy] = useSessionState(STRATEGY_KEY, NO_STRATEGY);
  const [status, setStatus] = useSessionState(STATUS_KEY, IDLE);

  // "running" saved before a page reload has no request behind it any more
  const running = status.state === "running" && requestActive;
  const error = status.state === "error" ? status.message ?? "Analysis failed." : "";

  /** Loads the strategy; `refresh` forces a new analysis instead of reusing a recent one. */
  const run = useCallback((refresh = false) => {
    if (inFlight) return inFlight;
    requestActive = true;
    setStatus({ state: "running" });
    inFlight = (async () => {
      try {
        const data = await getPortfolioStrategy(refresh);
        if (data.no_holdings) {
          setStrategy(null);
          setStatus({ state: "error", message: "Add some holdings to analyse your portfolio." });
        } else {
          setStrategy(data);
          setStatus(IDLE);
        }
      } catch (err) {
        requestActive = false;
        setStatus({ state: "error", message: getErrorMessage(err, "Analysis failed. Please try again.") });
      } finally {
        requestActive = false;
        inFlight = null;
      }
    })();
    return inFlight;
  }, [setStrategy, setStatus]);

  return { strategy, running, error, run, clear: clearStrategyCache };
}
