import { createCoordinator, type Coordinator } from "./coordinator";
import { defaultCoordinator, defaultStore } from "./defaults";
import { serializeKey } from "./key";
import { setActiveProviderStore } from "./providerScope";
import { bindRuntimeActions, type SteddyRuntimeActions } from "./runtimeActions";
import { createStore, type Store } from "./store";
import type { CacheSnapshot, Fetcher, Key } from "./types";
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
} & SteddyRuntimeActions;

function buildRuntime(store: Store, coordinator: Coordinator): SteddyRuntime {
  return { store, coordinator, ...bindRuntimeActions(store, coordinator) };
}

export function createRuntime(): SteddyRuntime {
  const store = createStore();
  const coordinator = createCoordinator(store);
  return buildRuntime(store, coordinator);
}

const defaultRuntime: SteddyRuntime = buildRuntime(defaultStore, defaultCoordinator);

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

  useEffect(() => {
    setActiveProviderStore(store);
    return () => setActiveProviderStore(null);
  }, [store]);

  const value = useMemo<SteddyRuntime>(() => buildRuntime(store, coordinator), [store, coordinator]);
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
  runtime: SteddyRuntime = defaultRuntime,
): Promise<void> {
  await runtime.prefetch(key, fetcher);
}

/** Drop one key, or the whole cache. Aborts in-flight work for deleted keys. */
export function clear(key?: Key, runtime: SteddyRuntime = defaultRuntime): void {
  runtime.clear(key);
}
