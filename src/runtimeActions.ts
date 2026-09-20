import type { Coordinator, RevalidateOptions } from "./coordinator";
import { createMutate } from "./mutate";
import { serializeKey } from "./key";
import type { Store } from "./store";
import type { Fetcher, Key } from "./types";

export type RuntimeRevalidateMatching = (
  match: (serializedKey: string, key: Key) => boolean,
  options?: RevalidateOptions,
) => Promise<void>;

export type SteddyRuntimeActions = {
  mutate: ReturnType<typeof createMutate>;
  revalidate: (key: Key, options?: RevalidateOptions) => Promise<void>;
  revalidateMatching: RuntimeRevalidateMatching;
  prefetch: <T>(key: Key, fetcher: Fetcher<T>) => Promise<void>;
  clear: (key?: Key) => void;
};

export function bindRuntimeActions(
  store: Store,
  coordinator: Coordinator,
): SteddyRuntimeActions {
  const mutate = createMutate(store, coordinator);

  async function revalidate(key: Key, options?: RevalidateOptions): Promise<void> {
    const serialized = serializeKey(key);
    await coordinator.revalidate(serialized, undefined, options);
  }

  async function revalidateMatching(
    match: (serializedKey: string, key: Key) => boolean,
    options?: RevalidateOptions,
  ): Promise<void> {
    await coordinator.revalidateMatching(match, options);
  }

  async function prefetch<T>(key: Key, fetcher: Fetcher<T>): Promise<void> {
    const serialized = serializeKey(key);
    coordinator.register(serialized, key, fetcher as Fetcher<unknown>);
    try {
      await coordinator.revalidate(serialized);
    } catch {
      /* cache entry retains error for a later hook */
    } finally {
      coordinator.unregister(serialized);
    }
  }

  function clear(key?: Key): void {
    if (key === undefined) {
      for (const active of coordinator.getRegisteredKeys()) {
        coordinator.abort(active);
      }
      coordinator.reset();
      store.clear();
      return;
    }
    const serialized = serializeKey(key);
    coordinator.abort(serialized);
    coordinator.unregister(serialized);
    store.delete(serialized);
  }

  return {
    mutate,
    revalidate,
    revalidateMatching,
    prefetch,
    clear,
  };
}
