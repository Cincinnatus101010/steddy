import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCoordinator } from "./defaults";
import { defaultStore } from "./defaults";
import { serializeKey } from "./key";
import { useLeeboard } from "./useLeeboard";

afterEach(() => {
  cleanup();
  defaultCoordinator.reset();
  defaultStore.clear();
});

describe("useLeeboard", () => {
  it("fetches and exposes data through the store snapshot", async () => {
    const { result } = renderHook(() =>
      useLeeboard("user", async () => ({ name: "Ada" })),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ name: "Ada" });
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
  });

  it("does not fetch when the key is null", async () => {
    const fetcher = vi.fn(async () => "nope");
    const { result } = renderHook(() => useLeeboard(null, fetcher));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(defaultCoordinator.isInFlight("unused")).toBe(false);
  });

  it("starts fetching when a null key becomes a real key", async () => {
    const fetcher = vi.fn(async () => "ok");
    const { result, rerender } = renderHook(
      ({ key }: { key: string | null }) => useLeeboard(key, fetcher),
      { initialProps: { key: null as string | null } },
    );
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ key: "user" });
    await waitFor(() => {
      expect(result.current.data).toBe("ok");
    });
  });

  it("shares one in-flight request across subscribers of the same key", async () => {
    const fetcher = vi.fn(async () => "shared");
    const a = renderHook(() => useLeeboard("user", fetcher));
    const b = renderHook(() => useLeeboard("user", fetcher));
    await waitFor(() => {
      expect(a.result.current.data).toBe("shared");
      expect(b.result.current.data).toBe("shared");
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    a.unmount();
    b.unmount();
  });

  it("unmounting mid-fetch does not throw and aborts if it was the last subscriber", async () => {
    let resolve!: (value: string) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((res) => {
          resolve = res;
        }),
    );

    const { unmount } = renderHook(() => useLeeboard("user", fetcher));
    expect(defaultCoordinator.isInFlight("user")).toBe(true);
    expect(() => unmount()).not.toThrow();
    expect(defaultCoordinator.isInFlight("user")).toBe(false);

    await act(async () => {
      resolve("late");
    });
    expect(defaultStore.get("user")?.data).toBeUndefined();
  });

  it("does not abort while another subscriber is still mounted", async () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {}));
    const first = renderHook(() => useLeeboard("user", fetcher));
    const second = renderHook(() => useLeeboard("user", fetcher));
    expect(defaultCoordinator.isInFlight("user")).toBe(true);
    first.unmount();
    expect(defaultCoordinator.isInFlight("user")).toBe(true);
    second.unmount();
    expect(defaultCoordinator.isInFlight("user")).toBe(false);
  });

  it("memoizes tuple keys by shallow equality so a new array does not resubscribe", async () => {
    const fetcher = vi.fn(async (key) => key);
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useLeeboard(["user", id], fetcher),
      { initialProps: { id: 1 } },
    );
    await waitFor(() => {
      expect(result.current.data).toEqual(["user", 1]);
    });
    rerender({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender({ id: 2 });
    await waitFor(() => {
      expect(result.current.data).toEqual(["user", 2]);
    });
    expect(defaultStore.get(serializeKey(["user", 2]))?.data).toEqual([
      "user",
      2,
    ]);
  });

  it("isLoading is true until the first value or error arrives", async () => {
    const { result } = renderHook(() =>
      useLeeboard("user", () => new Promise<string>(() => {})),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("isLoading is false after a fetcher error", async () => {
    const { result } = renderHook(() =>
      useLeeboard("user", async () => {
        throw new Error("nope");
      }),
    );
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("does not import plugins", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "useLeeboard.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/plugins/);
    expect(src).not.toMatch(/focusRevalidate|pollingRevalidate|reconnectRevalidate|retryOnError/);
  });

  it("throws the in-flight waiter when suspense is on", async () => {
    const { Suspense } = await import("react");
    const { render, screen } = await import("@testing-library/react");
    function View() {
      const { data } = useLeeboard("user", async () => "ada", { suspense: true });
      return <span>{String(data)}</span>;
    }
    render(
      <Suspense fallback={<span>wait</span>}>
        <View />
      </Suspense>,
    );
    expect(screen.getByText("wait")).toBeTruthy();
    expect(await screen.findByText("ada")).toBeTruthy();
  });
});
