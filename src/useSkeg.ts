import { useCallback, useRef, useSyncExternalStore } from "react";
import { useSkegRuntime } from "./context";
import { keysShallowEqual, serializeKey } from "./key";
import { EMPTY_SNAPSHOT } from "./store";
import type {
  Fetcher,
  Key,
  MutateFn,
  UseSkegOptions,
  UseSkegResult,
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

export function useSkeg<T>(
  key: Key | null,
  fetcher: Fetcher<T>,
  _options?: UseSkegOptions,
): UseSkegResult<T> {
  const { store, coordinator, mutate: runtimeMutate } = useSkegRuntime();
  const serialized = useSerializedKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;

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

  // Third argument avoids a server-render throw; v1 does not implement SSR.
  // Source: https://react.dev/reference/react/useSyncExternalStore
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const boundMutate = useCallback<MutateFn<T>>(
    (updater, options) => {
      if (keyRef.current == null) {
        return Promise.resolve(undefined);
      }
      return runtimeMutate(keyRef.current, updater, options);
    },
    [runtimeMutate],
  );

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
