import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clear, hydrate, SkegProvider } from "./context";
import { createCoordinator } from "./coordinator";
import { defaultCoordinator, defaultStore } from "./defaults";
import { createStore } from "./store";
import { useSkeg } from "./useSkeg";
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
      useSkeg("user", async () => ({ name: "server" })),
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

describe("SkegProvider", () => {
  it("isolates cache from the default store", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SkegProvider store={store} coordinator={coordinator}>
        {children}
      </SkegProvider>
    );
    const { result } = renderHook(
      () => useSkeg("user", async () => "scoped"),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.data).toBe("scoped");
    });
    expect(defaultStore.get("user")).toBeUndefined();
    expect(store.get("user")?.data).toBe("scoped");
  });
});
