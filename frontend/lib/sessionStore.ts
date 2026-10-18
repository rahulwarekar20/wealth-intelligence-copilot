/**
 * Tab-scoped state (chat, strategy) that survives navigating between pages.
 */
import { useCallback, useSyncExternalStore } from "react";

// Values persisted in sessionStorage for the current browser tab, exposed to
// React through useSyncExternalStore. The server snapshot is always the initial
// value, so server and first client render match (no hydration mismatch).
// An in-memory copy keeps things working if sessionStorage is unavailable.

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const parsedCache = new Map<string, { raw: string; value: unknown }>();

function readRaw(key: string): string | null {
  // sessionStorage is the source of truth; the memory copy is only a fallback
  // for browsers where sessionStorage is unavailable (it throws)
  try {
    return sessionStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, raw: string | null) {
  if (raw === null) memory.delete(key);
  else memory.set(key, raw);
  try {
    if (raw === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, raw);
  } catch {}
  listeners.get(key)?.forEach((notify) => notify());
}

function readValue<T>(key: string, initial: T): T {
  const raw = readRaw(key);
  if (raw === null) return initial;
  const cached = parsedCache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  try {
    const value = JSON.parse(raw) as T;
    parsedCache.set(key, { raw, value });
    return value;
  } catch {
    return initial;
  }
}

/** Resets the in-memory copies and re-renders their components; callers clear sessionStorage itself (login/logout). */
export function clearSessionStore() {
  memory.clear();
  parsedCache.clear();
  listeners.forEach((set) => set.forEach((notify) => notify()));
}

/** Forgets one stored value and notifies components using it. */
export function removeSessionValue(key: string) {
  writeRaw(key, null);
}

/**
 * Like useState, but persisted in sessionStorage under `key`.
 * `initial` must be a stable value (define it outside the component).
 */
export function useSessionState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(notify);
      return () => {
        listeners.get(key)?.delete(notify);
      };
    },
    [key]
  );

  const value = useSyncExternalStore(
    subscribe,
    () => readValue(key, initial),
    () => initial
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readValue(key, initial);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, initial]
  );

  const reset = useCallback(() => writeRaw(key, null), [key]);

  return [value, setValue, reset] as const;
}
