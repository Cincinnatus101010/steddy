import { describe, expect, it, vi } from "vitest";
import { createCoordinator } from "./coordinator";
import { createMutate } from "./mutate";
import { createStore } from "./store";

describe("mutate", () => {
  it("writes a sync updater immediately", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    await mutate("user", "next", { revalidate: false });
    expect(store.get("user")).toMatchObject({
      data: "next",
      error: undefined,
      isValidating: false,
    });
  });

  it("applies a function updater to current data", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    store.set("count", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    await mutate<number>("count", (current) => (current ?? 0) + 1, { revalidate: false });
    expect(store.get("count")?.data).toBe(2);
  });

  it("rolls a failed optimistic mutation back to the exact prior entry, including error", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    const previous = {
      data: "old",
      error: "saved-error",
      timestamp: 42,
      isValidating: false,
    };
    store.set("user", previous);

    await expect(
      mutate(
        "user",
        async () => {
          throw new Error("fail");
        },
        { revalidate: false },
      ),
    ).rejects.toThrow("fail");

    expect(store.get("user")).toBe(previous);
  });

  it("rolls back an optimistic write when the follow-up revalidate fails", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    const previous = {
      data: "old",
      error: "saved-error",
      timestamp: 42,
      isValidating: false,
    };
    store.set("user", previous);
    coordinator.register("user", "user", async () => {
      throw new Error("server");
    });

    await expect(mutate("user", "optimistic")).rejects.toThrow("server");
    expect(store.get("user")).toBe(previous);
  });

  it("keeps the optimistic value when rollbackOnError is false", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    coordinator.register("user", "user", async () => {
      throw new Error("server");
    });

    await expect(
      mutate("user", "optimistic", { rollbackOnError: false }),
    ).rejects.toThrow("server");
    expect(store.get("user")?.data).toBe("optimistic");
    expect(store.get("user")?.error).toBeInstanceOf(Error);
  });

  it("force-revalidates after a successful write", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const mutate = createMutate(store, coordinator);
    const fetcher = vi.fn(async () => "server");
    coordinator.register("user", "user", fetcher);
    store.set("user", {
      data: "old",
      error: undefined,
      timestamp: Date.now(),
      isValidating: false,
    });

    const result = await mutate("user", "optimistic");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toBe("server");
    expect(store.get("user")?.data).toBe("server");
  });
});
