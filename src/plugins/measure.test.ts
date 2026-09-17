import { describe, expect, it, vi } from "vitest";
import { createCoordinator } from "../coordinator";
import { createStore } from "../store";
import { measurePerf } from "./measure";
import type { Fetcher } from "../types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("measurePerf", () => {
  it("counts writes and elapsed ms for a successful fetch", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const perf = measurePerf(coordinator);

    await coordinator.revalidate("user", async () => "ok");

    const snap = perf.snapshot();
    expect(snap.starts).toBe(1);
    expect(snap.writes).toBe(1);
    expect(snap.aborts).toBe(0);
    expect(snap.dedups).toBe(0);
    expect(snap.errors).toBe(0);
    expect(snap.totalMs).toBeGreaterThanOrEqual(0);
    perf.stop();
  });

  it("counts an abort when a second revalidate replaces the first", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const perf = measurePerf(coordinator);
    const first = deferred<string>();
    const firstFetcher: Fetcher<string> = async (_key, { signal }) => {
      return await new Promise((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
        first.promise.then(resolve, reject);
      });
    };

    const p1 = coordinator.revalidate("user", firstFetcher);
    await coordinator.revalidate("user", async () => "second");
    first.resolve("first");
    await p1;

    const snap = perf.snapshot();
    expect(snap.starts).toBe(2);
    expect(snap.aborts).toBe(1);
    expect(snap.writes).toBe(1);
    expect(store.get("user")?.data).toBe("second");
    perf.stop();
  });

  it("counts a dedup when a fresh write is still inside the window", async () => {
    vi.useFakeTimers();
    const store = createStore();
    const coordinator = createCoordinator(store);
    const perf = measurePerf(coordinator);

    await coordinator.revalidate("user", async () => "ok");
    await coordinator.revalidate("user", async () => "again");

    const snap = perf.snapshot();
    expect(snap.starts).toBe(1);
    expect(snap.writes).toBe(1);
    expect(snap.dedups).toBe(1);
    perf.stop();
    vi.useRealTimers();
  });
});
