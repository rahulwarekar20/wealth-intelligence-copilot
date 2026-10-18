/**
 * usePortfolio: loads the signed-in user's portfolio summary and exposes
 * add / remove actions that refresh it afterwards.
 *
 * `onChange` runs after every successful add or remove — the dashboard uses it
 * to clear the AI strategy, which no longer matches the new holdings.
 */
import { useCallback, useEffect, useState } from "react";
import { addHolding, deleteHolding, getErrorMessage, getPortfolioSummary } from "./api";
import type { PortfolioSummary } from "./types";

/** A holding to add, already validated by the form. */
export interface NewHolding {
  ticker: string;
  quantity: number;
  cost_basis: number | null;
  account_type: string;
}

/** Portfolio state: { portfolio, loading, error, add, remove, refresh }. */
export function usePortfolio(onChange?: () => void) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setPortfolio(await getPortfolioSummary());
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your portfolio."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch fresh portfolio data on mount (prices are cached server-side for 5 minutes)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the request resolves
    reload();
  }, [reload]);

  /** Adds a holding; throws on failure so the form can show the message. */
  const add = useCallback(
    async (holding: NewHolding) => {
      await addHolding(holding);
      onChange?.();
      await reload();
    },
    [onChange, reload]
  );

  /** Removes a holding; failures are shown as the page-level error. */
  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteHolding(id);
        onChange?.();
        await reload();
      } catch (err) {
        setError(getErrorMessage(err, "Could not remove holding."));
      }
    },
    [onChange, reload]
  );

  /** Reloads after changes made elsewhere (e.g. an import), clearing dependent results. */
  const refresh = useCallback(async () => {
    onChange?.();
    await reload();
  }, [onChange, reload]);

  return { portfolio, loading, error, add, remove, refresh };
}
