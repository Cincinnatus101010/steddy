import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  clear,
  createRuntime,
  dump,
  hydrate,
  hydrateAll,
  SteddyProvider,
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

describe("clear", () => {
  it("removes a key and aborts in-flight work", () => {
    defaultStore.set("user", {
      data: "stale",
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
    expect(client.store.get("user")?.timestamp).toBe(0);
  });
});

describe("dump", () => {
  it("omits empty keys, errors, and in-flight flags", () => {
    const store = createStore();
    store.set("user", {
      data: { name: "Ada" },
      error: new Error("stale"),
      timestamp: 9,
      isValidating: true,
    });
    store.set("empty", {
      data: undefined,
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
      timestamp: 0,
      isValidating: false,
    });
  });
});
