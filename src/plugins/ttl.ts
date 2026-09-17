import type { EvictOptions } from "../types";

export type TtlEvictCoordinator = {
  evict(options: EvictOptions): string[];
};

export function ttlEvict(
  coordinator: TtlEvictCoordinator,
  options: EvictOptions & { interval?: number },
): () => void {
  const maxAge = options.maxAge;
  const maxKeys = options.maxKeys;
  const evictOptions: EvictOptions = {
    ...(maxAge != null ? { maxAge } : {}),
    ...(maxKeys != null ? { maxKeys } : {}),
  };
  const tick = (): void => {
    coordinator.evict(evictOptions);
  };
  tick();
  const id = setInterval(tick, options.interval ?? 30_000);
  return () => {
    clearInterval(id);
  };
}
