export type PollingCoordinator = {
  revalidate(key: string): Promise<void>;
};

export function pollingRevalidate(
  coordinator: PollingCoordinator,
  key: string,
  interval: number,
): () => void {
  const id = setInterval(() => {
    void coordinator.revalidate(key);
  }, interval);
  return () => {
    clearInterval(id);
  };
}
