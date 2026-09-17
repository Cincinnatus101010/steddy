export { useSkeg } from "./useSkeg";
export { mutate, createMutate } from "./mutate";
export { serializeKey } from "./key";
export { createStore } from "./store";
export { createCoordinator, DEDUP_WINDOW_MS } from "./coordinator";
export { defaultStore, defaultCoordinator } from "./defaults";
export { SkegProvider, hydrate, clear } from "./context";
export { focusRevalidate } from "./plugins/focus";
export { reconnectRevalidate } from "./plugins/reconnect";
export { pollingRevalidate } from "./plugins/polling";
export { retryOnError } from "./plugins/retry";

export type {
  Key,
  Serializable,
  CacheEntry,
  Fetcher,
  MutateUpdater,
  MutateOptions,
  MutateFn,
  UseSkegOptions,
  UseSkegResult,
} from "./types";
export type { Store } from "./store";
export type { Coordinator, RevalidateOptions } from "./coordinator";
export type { SkegRuntime } from "./context";
