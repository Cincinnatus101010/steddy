export type ReconnectCoordinator = {
  revalidate(key: string): Promise<void>;
  getRegisteredKeys(): string[];
};

export function reconnectRevalidate(
  coordinator: ReconnectCoordinator,
): () => void {
  const onOnline = (): void => {
    for (const key of coordinator.getRegisteredKeys()) {
      void coordinator.revalidate(key);
    }
  };
  window.addEventListener("online", onOnline);
  return () => {
    window.removeEventListener("online", onOnline);
  };
}
