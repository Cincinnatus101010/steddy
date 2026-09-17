import type { CacheEntry } from "./types";

/**
 * Dumb key-value store with per-key subscriptions.
 * Hard rule: this file must not import network requests, timers, or browser events.
 */
export type Store = {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
  subscribe(key: string, callback: () => void): () => void;
  getSnapshot(key: string): CacheEntry;
  subscriberCount(key: string): number;
  keys(): string[];
  clear(): void;
};

export const EMPTY_SNAPSHOT: CacheEntry = Object.freeze({
  data: undefined,
  hasData: false,
  error: undefined,
  timestamp: 0,
  isValidating: false,
});

export function createStore(): Store {
  const entries = new Map<string, CacheEntry>();
  const listeners = new Map<string, Set<() => void>>();

  function emit(key: string): void {
    const subs = listeners.get(key);
    if (!subs) {
      return;
    }
    for (const callback of subs) {
      callback();
    }
  }

  return {
    get(key) {
      return entries.get(key);
    },

    set(key, entry) {
      const existing = entries.get(key);
      if (
        existing &&
        Object.is(existing.data, entry.data) &&
        existing.hasData === entry.hasData &&
        existing.error === entry.error &&
        existing.timestamp === entry.timestamp &&
        existing.isValidating === entry.isValidating
      ) {
        return;
      }
      entries.set(key, entry);
      emit(key);
    },

    delete(key) {
      const existed = entries.delete(key);
      if (existed) {
        emit(key);
      }
    },

    subscribe(key, callback) {
      let subs = listeners.get(key);
      if (!subs) {
        subs = new Set();
        listeners.set(key, subs);
      }
      subs.add(callback);
      return () => {
        const current = listeners.get(key);
        if (!current) {
          return;
        }
        current.delete(callback);
        if (current.size === 0) {
          listeners.delete(key);
        }
      };
    },

    getSnapshot(key) {
      return entries.get(key) ?? EMPTY_SNAPSHOT;
    },

    subscriberCount(key) {
      return listeners.get(key)?.size ?? 0;
    },

    keys() {
      return [...entries.keys()];
    },

    clear() {
      const keys = new Set([...entries.keys(), ...listeners.keys()]);
      entries.clear();
      for (const key of keys) {
        emit(key);
      }
    },
  };
}
