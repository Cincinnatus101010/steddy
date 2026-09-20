import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  createRuntime,
  dump,
  hydrate,
  hydrateAll,
  prefetch,
  SteddyProvider,
  useSteddyRuntime,
} from "./context";
import { createCoordinator } from "./coordinator";
import { defaultCoordinator, defaultStore } from "./defaults";
import { createStore } from "./store";
import { useSteddy } from "./useSteddy";
import type { ReactNode } from "react";

afterEach(() => {
  cleanup();
  defaultCoordinator.reset();
  defaultStore.clear();
});

describe("hydrate", () => {
  it("seeds the store so the hook can render data immediately", async () => {
    hydrate("user", { name: "Ada" });
    const { result } = renderHook(() =>
      useSteddy("user", async () => ({ name: "server" })),
    );
    expect(result.current.data).toEqual({ name: "Ada" });
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => {
      expect(result.current.data).toEqual({ name: "server" });
    });
  });
});

describe("prefetch", () => {
  it("loads data into the cache without a mounted hook", async () => {
    const runtime = createRuntime();
    await prefetch("user", async () => ({ name: "Ada" }), runtime);
    expect(runtime.store.get("user")?.data).toEqual({ name: "Ada" });
    expect(runtime.coordinator.getRegisteredKeys()).toEqual([]);
  });
});

describe("clear", () => {
  it("removes a key and aborts in-flight work", () => {
    defaultStore.set("user", {
      data: "stale",
      hasData: true,
      error: undefined,
      timestamp: 1,
      isValidating: true,
    });
    defaultCoordinator.register("user", "user", async () => "nope");
    clear("user");
    expect(defaultStore.get("user")).toBeUndefined();
    expect(defaultCoordinator.isInFlight("user")).toBe(false);
  });
});

describe("SteddyProvider", () => {
  it("isolates cache from the default store", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SteddyProvider store={store} coordinator={coordinator}>
        {children}
      </SteddyProvider>
    );
    const { result } = renderHook(
      () => useSteddy("user", async () => "scoped"),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.data).toBe("scoped");
    });
    expect(defaultStore.get("user")).toBeUndefined();
    expect(store.get("user")?.data).toBe("scoped");
  });

  it("hydrates a dumped cache so SSR and the client see the same data", () => {
    const server = createRuntime();
    hydrate("user", { name: "Ada" }, server.store);
    const payload = dump(server.store);
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);

    const client = createRuntime();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SteddyProvider
        store={client.store}
        coordinator={client.coordinator}
        cache={payload}
      >
        {children}
      </SteddyProvider>
    );
    const { result } = renderHook(
      () => useSteddy("user", async () => ({ name: "server" })),
      { wrapper },
    );
    expect(result.current.data).toEqual({ name: "Ada" });
    expect(client.store.get("user")?.timestamp).toBe(payload.user!.timestamp);
  });

  it("does not re-hydrate when cache is a new object with the same payload", () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const payload = { user: { data: { name: "Ada" }, timestamp: 42 } };
    const fetcher = vi.fn(async () => ({ name: "client" }));
    const { rerender } = render(
      <SteddyProvider store={store} coordinator={coordinator} cache={payload}>
        <HookProbe fetcher={fetcher} />
      </SteddyProvider>,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender(
      <SteddyProvider
        store={store}
        coordinator={coordinator}
        cache={{ ...payload }}
      >
        <HookProbe fetcher={fetcher} />
      </SteddyProvider>,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

function HookProbe({
  fetcher,
}: {
  fetcher: (key: import("./types").Key) => Promise<{ name: string }>;
}) {
  useSteddy("user", fetcher);
  return null;
}

describe("runtime actions", () => {
  it("revalidateMatching uses the provider runtime", async () => {
    const runtime = createRuntime();
    const fetcher = vi.fn(async () => "fresh");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SteddyProvider store={runtime.store} coordinator={runtime.coordinator}>
        {children}
      </SteddyProvider>
    );
    renderHook(
      () => {
        useSteddy("keep", fetcher);
        return useSteddyRuntime();
      },
      { wrapper },
    );
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
    fetcher.mockClear();
    runtime.store.set("skip", {
      data: "x",
      hasData: true,
      error: undefined,
      timestamp: Date.now(),
      isValidating: false,
    });
    await runtime.revalidateMatching((serialized) => serialized === "keep", { force: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("dump", () => {
  it("omits empty keys, errors, and in-flight flags", () => {
    const store = createStore();
    store.set("user", {
      data: { name: "Ada" },
      hasData: true,
      error: new Error("stale"),
      timestamp: 9,
      isValidating: true,
    });
    store.set("empty", {
      data: undefined,
      hasData: false,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    expect(dump(store)).toEqual({
      user: { data: { name: "Ada" }, timestamp: 9 },
    });
    hydrateAll(dump(store), store);
    expect(store.get("user")).toMatchObject({
      data: { name: "Ada" },
      error: undefined,
      timestamp: 9,
      isValidating: false,
    });
  });
});
