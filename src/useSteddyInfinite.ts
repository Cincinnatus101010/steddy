import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useSteddyRuntime } from "./context";
import { serializeKey } from "./key";
import type { Fetcher, Key, MutateFn } from "./types";

export type UseSteddyInfiniteResult<T> = {
  data: T[] | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
  size: number;
  setSize: (next: number | ((current: number) => number)) => void;
  mutate: MutateFn<T[]>;
};

function collectPages<T>(
  getKey: (index: number, previousPageData: T | undefined) => Key | null,
  getData: (serialized: string) => T | undefined,
  size: number,
): { key: Key; serialized: string }[] {
  const pages: { key: Key; serialized: string }[] = [];
  let previous: T | undefined;
  for (let index = 0; index < size; index++) {
    const key = getKey(index, previous);
    if (key == null) {
      break;
    }
    const serialized = serializeKey(key);
    pages.push({ key, serialized });
    previous = getData(serialized);
  }
  return pages;
}

export function useSteddyInfinite<T>(
  getKey: (
    index: number,
    previousPageData: T | undefined,
  ) => Key | null,
  fetcher: Fetcher<T>,
  options?: { initialSize?: number },
): UseSteddyInfiniteResult<T> {
  const { store, coordinator, mutate: runtimeMutate } = useSteddyRuntime();
  const [size, setSizeState] = useState(options?.initialSize ?? 1);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;

  const pages = collectPages(
    getKey,
    (serialized) => store.get(serialized)?.data as T | undefined,
    size,
  );
  const serializedList = pages.map((page) => page.serialized).join("\0");

  for (const page of pages) {
    coordinator.register(page.serialized, page.key, (k, ctx) =>
      fetcherRef.current(k, ctx),
    );
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const currentPages = collectPages(
        getKeyRef.current,
        (serialized) => store.get(serialized)?.data as T | undefined,
        size,
      );
      const unsubscribes = currentPages.map((page) => {
        coordinator.register(page.serialized, page.key, (k, ctx) =>
          fetcherRef.current(k, ctx),
        );
        if (!coordinator.isInFlight(page.serialized)) {
          void coordinator.revalidate(page.serialized).catch(() => {});
        }
        return store.subscribe(page.serialized, onStoreChange);
      });
      return () => {
        for (const [index, page] of currentPages.entries()) {
          unsubscribes[index]?.();
          if (store.subscriberCount(page.serialized) === 0) {
            coordinator.scheduleRelease(page.serialized);
          }
        }
      };
    },
    [serializedList, size, store, coordinator],
  );

  const snapshotRef = useRef<{
    fingerprint: string;
    data: T[] | undefined;
    error: unknown;
    isValidating: boolean;
  }>({
    fingerprint: "",
    data: undefined,
    error: undefined,
    isValidating: false,
  });

  const getSnapshot = useCallback(() => {
    const currentPages = collectPages(
      getKeyRef.current,
      (serialized) => store.get(serialized)?.data as T | undefined,
      size,
    );
    const fingerprint = currentPages
      .map((page) => {
        const entry = store.getSnapshot(page.serialized);
        return `${page.serialized}:${entry.timestamp}:${entry.isValidating ? 1 : 0}:${entry.error == null ? 0 : 1}:${entry.data === undefined ? 0 : 1}`;
      })
      .join("|");
    if (snapshotRef.current.fingerprint === fingerprint) {
      return snapshotRef.current;
    }
    const loaded: T[] = [];
    let error: unknown;
    let isValidating = false;
    let missing = false;
    for (const page of currentPages) {
      const entry = store.getSnapshot(page.serialized);
      if (entry.isValidating) {
        isValidating = true;
      }
      if (entry.error != null && error === undefined) {
        error = entry.error;
      }
      if (entry.data === undefined) {
        missing = true;
        break;
      }
      loaded.push(entry.data as T);
    }
    snapshotRef.current = {
      fingerprint,
      data: missing && loaded.length === 0 ? undefined : loaded,
      error,
      isValidating,
    };
    return snapshotRef.current;
  }, [serializedList, size, store]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setSize = useCallback(
    (next: number | ((current: number) => number)) => {
      setSizeState((current) =>
        typeof next === "function" ? next(current) : next,
      );
    },
    [],
  );

  const boundMutate = useCallback<MutateFn<T[]>>(
    async (updater, mutateOptions) => {
      const currentPages = collectPages(
        getKeyRef.current,
        (serialized) => store.get(serialized)?.data as T | undefined,
        size,
      );
      const first = currentPages[0];
      if (!first) {
        return undefined;
      }
      if (updater !== undefined && typeof updater !== "function") {
        const pagesValue = updater as T[];
        const firstPage = pagesValue[0];
        if (firstPage !== undefined) {
          await runtimeMutate(first.key, firstPage, mutateOptions);
        }
        return pagesValue;
      }
      await Promise.all(
        currentPages.map((page) =>
          coordinator
            .revalidate(page.serialized, undefined, { force: true })
            .catch(() => {}),
        ),
      );
      return currentPages
        .map((page) => store.get(page.serialized)?.data as T | undefined)
        .filter((page): page is T => page !== undefined);
    },
    [coordinator, runtimeMutate, size, store],
  );

  const first = pages[0];
  const firstEntry = first ? store.getSnapshot(first.serialized) : undefined;

  return {
    data: snapshot.data,
    error: snapshot.error,
    isLoading:
      first != null &&
      firstEntry?.data === undefined &&
      firstEntry?.error == null,
    isValidating: snapshot.isValidating,
    size,
    setSize,
    mutate: boundMutate,
  };
}
