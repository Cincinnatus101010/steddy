export type Serializable =
  | string
  | number
  | boolean
  | null
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

export type Key = string | readonly [string, ...Serializable[]];

export type CacheEntry<T = unknown> = {
  data: T | undefined;
  /** True once a fetch or mutate settled successfully, even when data is undefined. */
  hasData: boolean;
  error: unknown;
  timestamp: number;
  isValidating: boolean;
};

export type Fetcher<T> = (
  key: Key,
  context: { signal: AbortSignal },
) => Promise<T>;

export type MutateUpdater<T> =
  | T
  | Promise<T>
  | ((current: T | undefined) => T | Promise<T>);

export type MutateOptions = {
  revalidate?: boolean;
  rollbackOnError?: boolean;
};

export type MutateFn<T> = (
  updater: MutateUpdater<T>,
  options?: MutateOptions,
) => Promise<T | undefined>;

export type UseSteddyOptions = {
  suspense?: boolean;
  keepPreviousData?: boolean;
  /** Ms before a cached value is treated as stale. Defaults to DEDUP_WINDOW_MS (2000). */
  staleTime?: number;
  /** While subscribed, revalidate on this interval (respects staleTime dedup). */
  refetchInterval?: number;
  /** When false (default), skip interval ticks while the document is hidden. */
  refetchWhenHidden?: boolean;
};

export type CacheSnapshot = {
  readonly [serializedKey: string]: {
    readonly data: unknown;
    readonly timestamp: number;
  };
};

export type EvictOptions = {
  maxAge?: number;
  maxKeys?: number;
};

export type UseSteddyResult<T> = {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
  mutate: MutateFn<T>;
};
