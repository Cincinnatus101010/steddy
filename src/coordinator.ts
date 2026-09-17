import type { EvictOptions, Fetcher, Key } from "./types";
import type { Store } from "./store";

export const DEDUP_WINDOW_MS = 2000;

export type RevalidateOptions = {
  force?: boolean;
};

export type Coordinator = {
  register(serializedKey: string, key: Key, fetcher: Fetcher<unknown>): void;
  unregister(serializedKey: string): void;
  revalidate(
    serializedKey: string,
    fetcher?: Fetcher<unknown>,
    options?: RevalidateOptions,
  ): Promise<void>;
  isInFlight(serializedKey: string): boolean;
  getInFlightPromise(serializedKey: string): Promise<void> | undefined;
  getRegisteredKeys(): string[];
  abort(serializedKey: string): void;
  evict(options: EvictOptions): string[];
  reset(): void;
};

type InFlight = {
  controller: AbortController;
  generation: number;
  waiter: Promise<void>;
  settle: () => void;
};

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function createCoordinator(store: Store): Coordinator {
  const registered = new Map<
    string,
    { key: Key; fetcher: Fetcher<unknown> }
  >();
  const inflight = new Map<string, InFlight>();
  let generation = 0;

  function abortInternal(serializedKey: string, markIdle: boolean): void {
    const current = inflight.get(serializedKey);
    if (!current) {
      return;
    }
    current.controller.abort();
    current.settle();
    inflight.delete(serializedKey);
    if (markIdle) {
      const entry = store.get(serializedKey);
      if (entry?.isValidating) {
        store.set(serializedKey, { ...entry, isValidating: false });
      }
    }
  }

  const coordinator: Coordinator = {
    register(serializedKey, key, fetcher) {
      registered.set(serializedKey, { key, fetcher });
    },

    unregister(serializedKey) {
      registered.delete(serializedKey);
    },

    async revalidate(serializedKey, fetcher, options) {
      if (!options?.force) {
        const entry = store.get(serializedKey);
        if (
          entry &&
          !entry.isValidating &&
          entry.error == null &&
          entry.data !== undefined &&
          Date.now() - entry.timestamp < DEDUP_WINDOW_MS
        ) {
          return;
        }
      }

      abortInternal(serializedKey, false);

      const record = registered.get(serializedKey);
      const key = record?.key ?? serializedKey;
      const run = fetcher ?? record?.fetcher;
      if (!run) {
        return;
      }

      const controller = new AbortController();
      const currentGeneration = ++generation;
      let settled = false;
      let settleWaiter!: () => void;
      const waiter = new Promise<void>((resolve) => {
        settleWaiter = resolve;
      });
      const settle = (): void => {
        if (!settled) {
          settled = true;
          settleWaiter();
        }
      };
      inflight.set(serializedKey, {
        controller,
        generation: currentGeneration,
        waiter,
        settle,
      });

      const previous = store.get(serializedKey);
      store.set(serializedKey, {
        data: previous?.data,
        error: previous?.error,
        timestamp: previous?.timestamp ?? 0,
        isValidating: true,
      });

      try {
        const data = await run(key, { signal: controller.signal });
        const stillCurrent =
          inflight.get(serializedKey)?.generation === currentGeneration;
        if (!stillCurrent || controller.signal.aborted) {
          return;
        }
        inflight.delete(serializedKey);
        store.set(serializedKey, {
          data,
          error: undefined,
          timestamp: Date.now(),
          isValidating: false,
        });
      } catch (error) {
        const stillCurrent =
          inflight.get(serializedKey)?.generation === currentGeneration;
        if (!stillCurrent || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        inflight.delete(serializedKey);
        const current = store.get(serializedKey);
        store.set(serializedKey, {
          data: current?.data,
          error,
          timestamp: current?.timestamp ?? 0,
          isValidating: false,
        });
        throw error;
      } finally {
        settle();
      }
    },

    isInFlight(serializedKey) {
      return inflight.has(serializedKey);
    },

    getInFlightPromise(serializedKey) {
      return inflight.get(serializedKey)?.waiter;
    },

    getRegisteredKeys() {
      return [...registered.keys()];
    },

    abort(serializedKey) {
      abortInternal(serializedKey, true);
    },

    evict(options) {
      const now = Date.now();
      const removable: { key: string; timestamp: number }[] = [];
      for (const key of store.keys()) {
        if (inflight.has(key) || store.subscriberCount(key) > 0) {
          continue;
        }
        const entry = store.get(key);
        if (!entry) {
          continue;
        }
        removable.push({ key, timestamp: entry.timestamp });
      }

      const victims = new Set<string>();
      if (options.maxAge != null) {
        for (const item of removable) {
          if (now - item.timestamp >= options.maxAge) {
            victims.add(item.key);
          }
        }
      }

      if (options.maxKeys != null) {
        const liveCount = store.keys().filter((key) => !victims.has(key)).length;
        let over = liveCount - options.maxKeys;
        if (over > 0) {
          const extra = removable
            .filter((item) => !victims.has(item.key))
            .sort((a, b) => a.timestamp - b.timestamp);
          for (const item of extra) {
            if (over <= 0) {
              break;
            }
            victims.add(item.key);
            over -= 1;
          }
        }
      }

      for (const key of victims) {
        abortInternal(key, false);
        registered.delete(key);
        store.delete(key);
      }
      return [...victims];
    },

    reset() {
      for (const key of [...inflight.keys()]) {
        abortInternal(key, false);
      }
      registered.clear();
    },
  };

  return coordinator;
}
