import type { Fetcher, Key } from "./types";
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
  getRegisteredKeys(): string[];
  abort(serializedKey: string): void;
  reset(): void;
};

type InFlight = {
  controller: AbortController;
  generation: number;
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
      inflight.set(serializedKey, { controller, generation: currentGeneration });

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
      }
    },

    isInFlight(serializedKey) {
      return inflight.has(serializedKey);
    },

    getRegisteredKeys() {
      return [...registered.keys()];
    },

    abort(serializedKey) {
      abortInternal(serializedKey, true);
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
