import { describe, expect, it, vi } from "vitest";
import {
  createCoordinator,
  DEDUP_WINDOW_MS,
} from "./coordinator";
import { createStore } from "./store";
import type { Fetcher } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("coordinator", () => {
  it("writes resolved data to the store", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    await coordinator.revalidate("user", async () => "ok");
    expect(store.get("user")).toMatchObject({
      data: "ok",
      error: undefined,
      isValidating: false,
    });
    expect(store.get("user")?.timestamp).toBeGreaterThan(0);
  });

  it("only the second in-flight response reaches the store", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const first = deferred<string>();
    const second = deferred<string>();
    const firstFetcher: Fetcher<string> = async (_key, { signal }) => {
      return await new Promise((resolve, reject) => {
        const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
        signal.addEventListener("abort", onAbort, { once: true });
        first.promise.then(resolve, reject);
      });
    };

    const p1 = coordinator.revalidate("user", firstFetcher);
    const p2 = coordinator.revalidate("user", async () => {
      second.resolve("second");
      return second.promise;
    });

    await p2;
    first.resolve("first");
    await p1;

    expect(store.get("user")?.data).toBe("second");
    expect(store.get("user")?.error).toBeUndefined();
  });

  it("does not write an aborted request as an error", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const pending = deferred<string>();
    const fetcher: Fetcher<string> = async (_key, { signal }) => {
      return await new Promise((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
        pending.promise.then(resolve, reject);
      });
    };

    const promise = coordinator.revalidate("user", fetcher);
    coordinator.abort("user");
    await promise;

    expect(store.get("user")?.data).toBeUndefined();
    expect(store.get("user")?.error).toBeUndefined();
    expect(store.get("user")?.isValidating).toBe(false);
    expect(coordinator.isInFlight("user")).toBe(false);
  });

  it("skips revalidate within the dedup window after success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const store = createStore();
      const coordinator = createCoordinator(store);
      const fetcher = vi.fn(async () => "ok");

      await coordinator.revalidate("user", fetcher);
      await coordinator.revalidate("user", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);

      vi.setSystemTime(Date.now() + DEDUP_WINDOW_MS + 1);
      await coordinator.revalidate("user", fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("force revalidate bypasses the dedup window", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const fetcher = vi.fn(async () => "ok");
    await coordinator.revalidate("user", fetcher);
    await coordinator.revalidate("user", fetcher, { force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps stale data when a later fetch fails", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    await coordinator.revalidate("user", async () => "stale");
    await expect(
      coordinator.revalidate("user", async () => {
        throw new Error("nope");
      }, { force: true }),
    ).rejects.toThrow("nope");
    expect(store.get("user")?.data).toBe("stale");
    expect(store.get("user")?.error).toBeInstanceOf(Error);
    expect(store.get("user")?.isValidating).toBe(false);
  });

  it("revalidates registered keys without passing a fetcher", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const fetcher = vi.fn(async (key: unknown) => key);
    coordinator.register("user-tuple", ["user", 7], fetcher);
    await coordinator.revalidate("user-tuple");
    expect(fetcher).toHaveBeenCalledWith(["user", 7], expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(store.get("user-tuple")?.data).toEqual(["user", 7]);
  });

  it("is independently testable against a real store with no plugins", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    expect(coordinator.getRegisteredKeys()).toEqual([]);
    coordinator.register("k", "k", async () => 1);
    expect(coordinator.getRegisteredKeys()).toEqual(["k"]);
  });
});
