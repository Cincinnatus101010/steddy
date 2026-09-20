import type { Store } from "./store";

let activeProviderStore: Store | null = null;

export function setActiveProviderStore(store: Store | null): void {
  activeProviderStore = store;
}

export function warnIfMisscopedGlobalMutate(store: Store, defaultStore: Store): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (
    activeProviderStore != null &&
    activeProviderStore !== defaultStore &&
    store === defaultStore
  ) {
    console.warn(
      "[steddy] The exported mutate() uses the default module cache, not your SteddyProvider runtime. Use hook mutate, useSteddyRuntime().mutate, or createMutate(store, coordinator) with the same runtime as your provider.",
    );
  }
}
