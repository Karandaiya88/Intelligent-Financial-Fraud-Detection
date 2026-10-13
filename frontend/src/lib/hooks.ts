"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** State persisted in localStorage (SSR-safe: starts with the default, hydrates in an effect). */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
  }, [key]);
  const set = useCallback((v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [key]);
  return [value, set];
}

export interface Prefs {
  seed: number;
  testSize: number;
  valSize: number;
  strategy: "max_f1" | "min_precision";
  minPrecision: number;
  pageSize: number;
}

export const DEFAULT_PREFS: Prefs = { seed: 42, testSize: 0.2, valSize: 0.2, strategy: "max_f1", minPrecision: 0.9, pageSize: 25 };

export function usePrefs(): [Prefs, (p: Prefs) => void] {
  const [stored, setStored] = usePersistentState<Prefs>("fraud_prefs", DEFAULT_PREFS);
  return [{ ...DEFAULT_PREFS, ...stored }, setStored];
}

/** Runs an async loader, exposing loading/error state and a reload callback. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}
