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

export type UseSkegOptions = Record<string, never>;

export type UseSkegResult<T> = {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
  mutate: MutateFn<T>;
};
