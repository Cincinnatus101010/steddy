import type { CoordinatorEvent } from "../coordinator";

export type MeasureCoordinator = {
  subscribe(listener: (event: CoordinatorEvent) => void): () => void;
};

export type PerfSnapshot = {
  starts: number;
  aborts: number;
  dedups: number;
  writes: number;
  errors: number;
  totalMs: number;
};

export function measurePerf(
  coordinator: MeasureCoordinator,
  onEvent?: (event: CoordinatorEvent) => void,
): {
  snapshot: () => PerfSnapshot;
  reset: () => void;
  stop: () => void;
} {
  const snap: PerfSnapshot = {
    starts: 0,
    aborts: 0,
    dedups: 0,
    writes: 0,
    errors: 0,
    totalMs: 0,
  };

  const stop = coordinator.subscribe((event) => {
    switch (event.type) {
      case "start":
        snap.starts += 1;
        break;
      case "abort":
        snap.aborts += 1;
        snap.totalMs += event.ms;
        break;
      case "dedup":
        snap.dedups += 1;
        break;
      case "write":
        snap.writes += 1;
        snap.totalMs += event.ms;
        break;
      case "error":
        snap.errors += 1;
        snap.totalMs += event.ms;
        break;
    }
    onEvent?.(event);
  });

  return {
    snapshot: () => ({ ...snap }),
    reset() {
      snap.starts = 0;
      snap.aborts = 0;
      snap.dedups = 0;
      snap.writes = 0;
      snap.errors = 0;
      snap.totalMs = 0;
    },
    stop,
  };
}
