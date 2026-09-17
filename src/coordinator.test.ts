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

  it("exposes one waiter for the current in-flight generation", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const pending = deferred<string>();
    const run = coordinator.revalidate("user", async () => pending.promise);
    const waiter = coordinator.getInFlightPromise("user");
    expect(waiter).toBeDefined();
    pending.resolve("ok");
    await run;
    await waiter;
    expect(coordinator.getInFlightPromise("user")).toBeUndefined();
    expect(store.get("user")?.data).toBe("ok");
  });

  it("evicts unused stale keys and never in-flight or subscribed ones", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const store = createStore();
      const coordinator = createCoordinator(store);
      store.set("old", {
        data: 1,
        error: undefined,
        timestamp: Date.now() - 10_000,
        isValidating: false,
      });
      store.set("fresh", {
        data: 2,
        error: undefined,
        timestamp: Date.now(),
        isValidating: false,
      });
      const pending = deferred<string>();
      void coordinator.revalidate("busy", async () => pending.promise);
      const unsubscribe = store.subscribe("watched", () => {});
      store.set("watched", {
        data: 3,
        error: undefined,
        timestamp: Date.now() - 10_000,
        isValidating: false,
      });

      expect(coordinator.evict({ maxAge: 5_000 }).sort()).toEqual(["old"]);
      expect(store.get("old")).toBeUndefined();
      expect(store.get("fresh")?.data).toBe(2);
      expect(store.get("watched")?.data).toBe(3);
      expect(coordinator.isInFlight("busy")).toBe(true);

      unsubscribe();
      expect(coordinator.evict({ maxAge: 5_000 })).toEqual(["watched"]);
      pending.resolve("ok");
    } finally {
      vi.useRealTimers();
    }
  });

  it("evicts oldest unused keys when over maxKeys", () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    store.set("a", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    store.set("b", {
      data: 2,
      error: undefined,
      timestamp: 2,
      isValidating: false,
    });
    store.set("c", {
      data: 3,
      error: undefined,
      timestamp: 3,
      isValidating: false,
    });
    expect(coordinator.evict({ maxKeys: 1 })).toEqual(["a", "b"]);
    expect(store.keys()).toEqual(["c"]);
  });
});
