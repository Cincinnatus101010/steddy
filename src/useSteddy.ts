import { useCallback, useRef, useSyncExternalStore } from "react";
import { DEDUP_WINDOW_MS } from "./coordinator";
import { useSteddyRuntime } from "./context";
import { keysShallowEqual, serializeKey } from "./key";
import { EMPTY_SNAPSHOT } from "./store";
import type {
  Fetcher,
  Key,
  MutateFn,
  UseSteddyOptions,
  UseSteddyResult,
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

export function useSteddy<T>(
  key: Key | null,
  fetcher: Fetcher<T>,
  options?: UseSteddyOptions,
): UseSteddyResult<T> {
  const { store, coordinator, mutate: runtimeMutate } = useSteddyRuntime();
  const serialized = useSerializedKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;
  const staleTime = options?.staleTime ?? DEDUP_WINDOW_MS;
  const staleTimeRef = useRef(staleTime);
  staleTimeRef.current = staleTime;
  const refetchIntervalRef = useRef(options?.refetchInterval);
  refetchIntervalRef.current = options?.refetchInterval;
  const refetchWhenHiddenRef = useRef(options?.refetchWhenHidden ?? false);
  refetchWhenHiddenRef.current = options?.refetchWhenHidden ?? false;

  if (serialized != null && key != null) {
    coordinator.register(
      serialized,
      key,
      (k, ctx) => fetcherRef.current(k, ctx),
      { staleTime: staleTimeRef.current },
    );
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (serialized == null || keyRef.current == null) {
        return () => {};
      }
      const originalKey = keyRef.current;
      coordinator.register(
        serialized,
        originalKey,
        (k, ctx) => fetcherRef.current(k, ctx),
        { staleTime: staleTimeRef.current },
      );
      const unsubscribe = store.subscribe(serialized, onStoreChange);
      if (!coordinator.isInFlight(serialized)) {
        void coordinator.revalidate(serialized).catch(() => {});
      }

      let pollTimer: ReturnType<typeof setTimeout> | undefined;
      let pollStopped = false;

      const schedulePoll = () => {
        const intervalMs = refetchIntervalRef.current;
        if (intervalMs == null || intervalMs <= 0) return;
        pollTimer = setTimeout(() => {
          if (pollStopped) return;
          if (
            !refetchWhenHiddenRef.current &&
            typeof document !== "undefined" &&
            document.visibilityState !== "visible"
          ) {
            schedulePoll();
            return;
          }
          void coordinator.revalidate(serialized).catch(() => {});
          schedulePoll();
        }, intervalMs);
      };

      schedulePoll();

      return () => {
        pollStopped = true;
        if (pollTimer !== undefined) {
          clearTimeout(pollTimer);
        }
        unsubscribe();
        if (store.subscriberCount(serialized) === 0) {
          coordinator.scheduleRelease(serialized);
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

  const keepPreviousData = options?.keepPreviousData === true;
  const previousRef = useRef<{ serialized: string; data: T } | undefined>(
    undefined,
  );
  if (serialized != null && snapshot.hasData) {
    previousRef.current = { serialized, data: snapshot.data as T };
  }

  const data =
    keepPreviousData &&
    serialized != null &&
    !snapshot.hasData &&
    snapshot.error == null &&
    previousRef.current != null &&
    previousRef.current.serialized !== serialized
      ? previousRef.current.data
      : (snapshot.data as T | undefined);

  if (options?.suspense && serialized != null) {
    if (snapshot.error != null) {
      throw snapshot.error;
    }
    if (!snapshot.hasData && data === undefined) {
      const waiter =
        coordinator.getInFlightPromise(serialized) ??
        coordinator.revalidate(serialized).catch(() => {});
      throw waiter;
    }
  }

  return {
    data,
    error: snapshot.error,
    isLoading:
      serialized != null &&
      !snapshot.hasData &&
      snapshot.error == null &&
      data === undefined,
    isValidating: snapshot.isValidating,
    mutate: boundMutate,
  };
}
