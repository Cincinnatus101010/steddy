import { keysWithSubscribers, type SubscribedStore } from "./subscribedKeys";

export type ReconnectCoordinator = {
  revalidate(key: string): Promise<void>;
  getRegisteredKeys(): string[];
};

export function reconnectRevalidate(
  coordinator: ReconnectCoordinator,
  store?: SubscribedStore,
): () => void {
  const onOnline = (): void => {
    const keys = store
      ? keysWithSubscribers(coordinator.getRegisteredKeys(), store)
      : coordinator.getRegisteredKeys();
    for (const key of keys) {
      void coordinator.revalidate(key);
    }
  };
  window.addEventListener("online", onOnline);
  return () => {
    window.removeEventListener("online", onOnline);
  };
}
