import { createCoordinator, type Coordinator } from "./coordinator";
import { createMutate } from "./mutate";
import { defaultCoordinator, defaultStore } from "./defaults";
import { createStore, type Store } from "./store";
import type { CacheSnapshot, Fetcher, Key } from "./types";
import { serializeKey } from "./key";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export type SteddyRuntime = {
  store: Store;
  coordinator: Coordinator;
  mutate: ReturnType<typeof createMutate>;
};

export function createRuntime(): SteddyRuntime {
  const store = createStore();
  const coordinator = createCoordinator(store);
  return {
    store,
    coordinator,
    mutate: createMutate(store, coordinator),
  };
}

const defaultRuntime: SteddyRuntime = {
  store: defaultStore,
  coordinator: defaultCoordinator,
  mutate: createMutate(defaultStore, defaultCoordinator),
};

const SteddyContext = createContext<SteddyRuntime>(defaultRuntime);

export function SteddyProvider({
  store,
  coordinator,
  cache,
  children,
}: {
  store: Store;
  coordinator: Coordinator;
  cache?: CacheSnapshot;
  children: ReactNode;
}) {
  const hydratedFingerprint = useRef<string | null>(null);
  useEffect(() => {
    if (!cache) {
      hydratedFingerprint.current = null;
      return;
    }
    const fingerprint = JSON.stringify(cache);
    if (hydratedFingerprint.current === fingerprint) {
      return;
    }
    hydratedFingerprint.current = fingerprint;
    hydrateAll(cache, store);
  }, [cache, store]);

  const value = useMemo<SteddyRuntime>(
    () => ({
      store,
      coordinator,
      mutate: createMutate(store, coordinator),
    }),
    [store, coordinator],
  );
  return <SteddyContext.Provider value={value}>{children}</SteddyContext.Provider>;
}

let warnedDefaultOnServer = false;

export function useSteddyRuntime(): SteddyRuntime {
  const runtime = useContext(SteddyContext);
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window === "undefined" &&
    runtime === defaultRuntime &&
    !warnedDefaultOnServer
  ) {
    warnedDefaultOnServer = true;
    console.warn(
      "[steddy] useSteddy on the server without SteddyProvider shares one cache across requests. Use createRuntime() per request.",
    );
  }
  return runtime;
}

/** Seed the cache so the next render can show data immediately. Timestamp is 0 so mount still revalidates. */
export function hydrate<T>(key: Key, data: T, store: Store = defaultStore): void {
  store.set(serializeKey(key), {
    data,
    hasData: true,
    error: undefined,
    timestamp: 0,
    isValidating: false,
  });
}

/** JSON-safe cache payload for SSR / RSC client boundaries. Errors and in-flight flags are omitted. */
export function dump(store: Store = defaultStore): CacheSnapshot {
  const snapshot: Record<string, { data: unknown; timestamp: number }> = {};
  for (const key of store.keys()) {
    const entry = store.get(key);
    if (!entry?.hasData) {
      continue;
    }
    snapshot[key] = { data: entry.data, timestamp: entry.timestamp };
  }
  return snapshot;
}

/** Restore a dumped snapshot. Timestamps from dump are preserved so dedup can skip immediate refetch. */
export function hydrateAll(
  snapshot: CacheSnapshot,
  store: Store = defaultStore,
): void {
  for (const [key, payload] of Object.entries(snapshot)) {
    store.set(key, {
      data: payload.data,
      hasData: true,
      error: undefined,
      timestamp: payload.timestamp,
      isValidating: false,
    });
  }
}

/** Warm a key without mounting a hook. Leaves data in the cache when the fetch completes. */
export async function prefetch<T>(
  key: Key,
  fetcher: Fetcher<T>,
  runtime: Pick<SteddyRuntime, "store" | "coordinator"> = defaultRuntime,
): Promise<void> {
  const serialized = serializeKey(key);
  runtime.coordinator.register(serialized, key, fetcher as Fetcher<unknown>);
  try {
    await runtime.coordinator.revalidate(serialized);
  } catch {
    // Errors remain on the cache entry for a later hook mount.
  } finally {
    runtime.coordinator.unregister(serialized);
  }
}

/** Drop one key, or the whole cache. Aborts in-flight work for deleted keys. */
export function clear(
  key?: Key,
  runtime: Pick<SteddyRuntime, "store" | "coordinator"> = defaultRuntime,
): void {
  if (key === undefined) {
    for (const active of runtime.coordinator.getRegisteredKeys()) {
      runtime.coordinator.abort(active);
    }
    runtime.coordinator.reset();
    runtime.store.clear();
    return;
  }
  const serialized = serializeKey(key);
  runtime.coordinator.abort(serialized);
  runtime.coordinator.unregister(serialized);
  runtime.store.delete(serialized);
}
