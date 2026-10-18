/**
 * useAlerts: the user's alerts, shared by the sidebar bell and the Alerts page.
 *
 * State lives at module level so both stay in sync: marking an alert read on
 * the page updates the sidebar badge immediately. Alerts are fetched when a
 * component first uses the hook and every POLL_MS after that; the backend
 * throttles its market checks, so polling is cheap.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getAlerts, markAlertsRead } from "./api";
import type { AppAlert } from "./types";

const POLL_MS = 5 * 60 * 1000;

interface AlertState {
  alerts: AppAlert[];
  unread: number;
  loaded: boolean;
}

const EMPTY: AlertState = { alerts: [], unread: 0, loaded: false };
let state: AlertState = EMPTY;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
// One polling timer shared by every component using the hook
let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function setState(next: AlertState) {
  state = next;
  listeners.forEach((notify) => notify());
}

/** Fetches alerts (one request at a time); failures keep the last known alerts. */
function refresh(): Promise<void> {
  inFlight ??= getAlerts()
    .then((data) => setState({ ...data, loaded: true }))
    .catch(() => setState({ ...state, loaded: true }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Alerts state: { alerts, unread, loaded, refresh, markRead, markAllRead }. */
export function useAlerts() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);

  // Load now, then poll while at least one component shows alerts.
  // (Logging out reloads the page, which clears this state for the next user.)
  useEffect(() => {
    refresh();
    users += 1;
    timer ??= setInterval(refresh, POLL_MS);
    return () => {
      users -= 1;
      if (users === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    setState({
      ...state,
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unread: Math.max(0, state.unread - (state.alerts.find((a) => a.id === id && !a.read) ? 1 : 0)),
    });
    await markAlertsRead(id).catch(() => refresh());
  }, []);

  const markAllRead = useCallback(async () => {
    setState({ ...state, alerts: state.alerts.map((a) => ({ ...a, read: true })), unread: 0 });
    await markAlertsRead().catch(() => refresh());
  }, []);

  return { ...snapshot, refresh, markRead, markAllRead };
}
