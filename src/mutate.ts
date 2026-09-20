import type { Coordinator } from "./coordinator";
import { defaultCoordinator, defaultStore } from "./defaults";
import { serializeKey } from "./key";
import { warnIfMisscopedGlobalMutate } from "./providerScope";
import type { Store } from "./store";
import type { Key, MutateOptions, MutateUpdater } from "./types";

function isThenable<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<T>).then === "function"
  );
}

export function createMutate(store: Store, coordinator: Coordinator) {
  return async function mutate<T>(
    key: Key,
    updater: MutateUpdater<T>,
    options?: MutateOptions,
  ): Promise<T | undefined> {
    warnIfMisscopedGlobalMutate(store, defaultStore);
    const revalidate = options?.revalidate ?? true;
    const rollbackOnError = options?.rollbackOnError ?? true;
    const serialized = serializeKey(key);
    const previous = store.get(serialized);

    const restore = (): void => {
      if (previous === undefined) {
        store.delete(serialized);
      } else {
        store.set(serialized, previous);
      }
    };

    try {
      const currentData = previous?.data as T | undefined;
      const next =
        typeof updater === "function"
          ? (updater as (current: T | undefined) => T | Promise<T>)(currentData)
          : updater;

      if (isThenable(next)) {
        store.set(serialized, {
          data: currentData,
          hasData: previous?.hasData ?? false,
          error: previous?.error,
          timestamp: previous?.timestamp ?? 0,
          isValidating: true,
        });
        const resolved = await next;
        store.set(serialized, {
          data: resolved,
          hasData: true,
          error: undefined,
          timestamp: Date.now(),
          isValidating: revalidate,
        });
      } else {
        store.set(serialized, {
          data: next,
          hasData: true,
          error: undefined,
          timestamp: Date.now(),
          isValidating: revalidate,
        });
      }

      if (revalidate) {
        await coordinator.revalidate(serialized, undefined, { force: true });
      }

      return store.get(serialized)?.data as T | undefined;
    } catch (error) {
      if (rollbackOnError) {
        restore();
      } else {
        const current = store.get(serialized);
        store.set(serialized, {
          data: current?.data,
          hasData: current?.hasData ?? false,
          error,
          timestamp: current?.timestamp ?? Date.now(),
          isValidating: false,
        });
      }
      throw error;
    }
  };
}

export const mutate = createMutate(defaultStore, defaultCoordinator);
