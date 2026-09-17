import type { Coordinator } from "../coordinator";
import type { Store } from "../store";
import type { EvictOptions } from "../types";
import { focusRevalidate } from "./focus";
import { reconnectRevalidate } from "./reconnect";
import { ttlEvict } from "./ttl";

export type AttachDefaultsOptions = {
  ttl?: EvictOptions & { interval?: number };
};

/** Wire focus, reconnect, and TTL eviction once at the app root. */
export function attachDefaults(
  coordinator: Coordinator,
  store: Store,
  options?: AttachDefaultsOptions,
): () => void {
  const stops = [
    focusRevalidate(coordinator, store),
    reconnectRevalidate(coordinator, store),
    ttlEvict(coordinator, options?.ttl ?? { maxAge: 300_000 }),
  ];
  return () => {
    for (const stop of stops) {
      stop();
    }
  };
}
