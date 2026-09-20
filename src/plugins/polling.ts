export type PollingCoordinator = {
  revalidate(key: string): Promise<void>;
};

export type PollingRevalidateOptions = {
  /** When true (default), skip ticks while the document is hidden. */
  whenVisible?: boolean;
};

export function pollingRevalidate(
  coordinator: PollingCoordinator,
  key: string,
  interval: number,
  options?: PollingRevalidateOptions,
): () => void {
  const whenVisible = options?.whenVisible !== false;
  const id = setInterval(() => {
    if (
      whenVisible &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    void coordinator.revalidate(key);
  }, interval);
  return () => {
    clearInterval(id);
  };
}
