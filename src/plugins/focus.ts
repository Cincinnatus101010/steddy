import { keysWithSubscribers, type SubscribedStore } from "./subscribedKeys";

export type FocusCoordinator = {
  revalidate(key: string): Promise<void>;
  getRegisteredKeys(): string[];
};

export function focusRevalidate(
  coordinator: FocusCoordinator,
  store?: SubscribedStore,
): () => void {
  const run = (): void => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    const keys = store
      ? keysWithSubscribers(coordinator.getRegisteredKeys(), store)
      : coordinator.getRegisteredKeys();
    for (const key of keys) {
      void coordinator.revalidate(key);
    }
  };
  if (typeof document === "undefined") {
    return () => {};
  }
  document.addEventListener("visibilitychange", run);
  return () => {
    document.removeEventListener("visibilitychange", run);
  };
}
