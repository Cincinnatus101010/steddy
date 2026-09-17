import { useCallback, useRef, useSyncExternalStore } from "react";
import { useLeeboardRuntime } from "./context";
import { keysShallowEqual, serializeKey } from "./key";
import { EMPTY_SNAPSHOT } from "./store";
import type {
  Fetcher,
  Key,
  MutateFn,
  UseLeeboardOptions,
  UseLeeboardResult,
} from "./types";

function useSerializedKey(key: Key | null): string | null {
  const prevKey = useRef<Key | null>(null);
  const prevSerialized = useRef<string | null>(null);
  if (key == null) {
    prevKey.current = null;
    prevSerialized.current = null;
    return null;
  }
  if (
    prevSerialized.current != null &&
    keysShallowEqual(prevKey.current, key)
  ) {
    return prevSerialized.current;
  }
  prevKey.current = key;
  prevSerialized.current = serializeKey(key);
  return prevSerialized.current;
}

export function useLeeboard<T>(
  key: Key | null,
  fetcher: Fetcher<T>,
  options?: UseLeeboardOptions,
): UseLeeboardResult<T> {
  const { store, coordinator, mutate: runtimeMutate } = useLeeboardRuntime();
  const serialized = useSerializedKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;

  if (serialized != null && key != null) {
    coordinator.register(serialized, key, (k, ctx) =>
      fetcherRef.current(k, ctx),
    );
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (serialized == null || keyRef.current == null) {
        return () => {};
      }
      const originalKey = keyRef.current;
      coordinator.register(serialized, originalKey, (k, ctx) =>
        fetcherRef.current(k, ctx),
      );
      const unsubscribe = store.subscribe(serialized, onStoreChange);
      if (!coordinator.isInFlight(serialized)) {
        void coordinator.revalidate(serialized).catch(() => {});
      }
      return () => {
        unsubscribe();
        if (store.subscriberCount(serialized) === 0) {
          coordinator.abort(serialized);
          coordinator.unregister(serialized);
        }
      };
    },
    [serialized, store, coordinator],
  );

  const getSnapshot = useCallback(() => {
    if (serialized == null) {
      return EMPTY_SNAPSHOT;
    }
    return store.getSnapshot(serialized);
  }, [serialized, store]);

  // Same snapshot on the server so a dumped cache can render without a mismatch.
  // Source: https://react.dev/reference/react/useSyncExternalStore
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const boundMutate = useCallback<MutateFn<T>>(
    (updater, mutateOptions) => {
      if (keyRef.current == null) {
        return Promise.resolve(undefined);
      }
      return runtimeMutate(keyRef.current, updater, mutateOptions);
    },
    [runtimeMutate],
  );

  if (options?.suspense && serialized != null) {
    if (snapshot.error != null) {
      throw snapshot.error;
    }
    if (snapshot.data === undefined) {
      const waiter =
        coordinator.getInFlightPromise(serialized) ??
        coordinator.revalidate(serialized).catch(() => {});
      throw waiter;
    }
  }

  return {
    data: snapshot.data as T | undefined,
    error: snapshot.error,
    isLoading:
      serialized != null &&
      snapshot.data === undefined &&
      snapshot.error == null,
    isValidating: snapshot.isValidating,
    mutate: boundMutate,
  };
}
