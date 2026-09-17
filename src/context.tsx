import { createMutate } from "./mutate";
import { defaultCoordinator, defaultStore } from "./defaults";
import type { Coordinator } from "./coordinator";
import type { Store } from "./store";
import type { Key } from "./types";
import { serializeKey } from "./key";
import { createContext, useContext, useMemo, type ReactNode } from "react";

export type SkegRuntime = {
  store: Store;
  coordinator: Coordinator;
  mutate: ReturnType<typeof createMutate>;
};

const defaultRuntime: SkegRuntime = {
  store: defaultStore,
  coordinator: defaultCoordinator,
  mutate: createMutate(defaultStore, defaultCoordinator),
};

const SkegContext = createContext<SkegRuntime>(defaultRuntime);

export function SkegProvider({
  store,
  coordinator,
  children,
}: {
  store: Store;
  coordinator: Coordinator;
  children: ReactNode;
}) {
  const value = useMemo<SkegRuntime>(
    () => ({
      store,
      coordinator,
      mutate: createMutate(store, coordinator),
    }),
    [store, coordinator],
  );
  return <SkegContext.Provider value={value}>{children}</SkegContext.Provider>;
}

export function useSkegRuntime(): SkegRuntime {
  return useContext(SkegContext);
}

/** Seed the cache so the next render can show data immediately. Timestamp is 0 so mount still revalidates. */
export function hydrate<T>(key: Key, data: T, store: Store = defaultStore): void {
  store.set(serializeKey(key), {
    data,
    error: undefined,
    timestamp: 0,
    isValidating: false,
  });
}

/** Drop one key, or the whole cache. Aborts in-flight work for deleted keys. */
export function clear(
  key?: Key,
  runtime: Pick<SkegRuntime, "store" | "coordinator"> = defaultRuntime,
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
