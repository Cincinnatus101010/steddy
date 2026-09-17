export type FocusCoordinator = {
  revalidate(key: string): Promise<void>;
  getRegisteredKeys(): string[];
};

export function focusRevalidate(coordinator: FocusCoordinator): () => void {
  const onFocus = (): void => {
    for (const key of coordinator.getRegisteredKeys()) {
      void coordinator.revalidate(key);
    }
  };
  window.addEventListener("focus", onFocus);
  return () => {
    window.removeEventListener("focus", onFocus);
  };
}
