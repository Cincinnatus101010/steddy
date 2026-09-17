import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { defaultCoordinator, defaultStore } from "./defaults";
import { serializeKey } from "./key";
import { useSteddyInfinite, collectPages } from "./useSteddyInfinite";
import type { Key } from "./types";

afterEach(() => {
  cleanup();
  defaultCoordinator.reset();
  defaultStore.clear();
});

describe("useSteddyInfinite", () => {
  it("loads pages independently and concatenates them", async () => {
    const getKey = (
      index: number,
      previous: string[] | undefined,
    ): Key | null => {
      if (previous && previous.length === 0) {
        return null;
      }
      return ["list", index];
    };
    const { result } = renderHook(() =>
      useSteddyInfinite(getKey, async (key) => {
        const index = Array.isArray(key) ? key[1] : 0;
        return [`item-${index}`];
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"]]);
    });
    expect(result.current.isLoading).toBe(false);

    result.current.setSize(2);
    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"], ["item-1"]]);
    });
  });

  it("does not collect a later page that serializes to the same key", () => {
    type Page = { item: number; next: number };
    const getKey = (index: number, previous: Page | undefined): Key | null => {
      if (index === 0) {
        return ["feed", 0];
      }
      return ["feed", previous?.next ?? 0];
    };
    const pages = collectPages(getKey, () => undefined, 2);
    expect(pages).toEqual([
      { key: ["feed", 0], serialized: serializeKey(["feed", 0]) },
    ]);
  });

  it("writes every page from an array updater", async () => {
    const getKey = (index: number): Key | null => ["list", index];
    const { result } = renderHook(() =>
      useSteddyInfinite(getKey, async (key) => {
        const index = Array.isArray(key) ? key[1] : 0;
        return [`item-${index}`];
      }),
    );
    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"]]);
    });
    await act(async () => {
      result.current.setSize(2);
    });
    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"], ["item-1"]]);
    });

    await act(async () => {
      await result.current.mutate(
        [
          ["a"],
          ["b"],
        ],
        { revalidate: false },
      );
    });
    expect(result.current.data).toEqual([["a"], ["b"]]);
  });

  it("applies a function updater to the concatenated pages", async () => {
    const getKey = (index: number): Key | null => ["list", index];
    const { result } = renderHook(() =>
      useSteddyInfinite(getKey, async (key) => {
        const index = Array.isArray(key) ? key[1] : 0;
        return [`item-${index}`];
      }),
    );
    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"]]);
    });
    await act(async () => {
      result.current.setSize(2);
    });
    await waitFor(() => {
      expect(result.current.data).toEqual([["item-0"], ["item-1"]]);
    });

    await act(async () => {
      await result.current.mutate(
        (current) => (current ?? []).map((page) => [...page, "x"]),
        { revalidate: false },
      );
    });
    expect(result.current.data).toEqual([
      ["item-0", "x"],
      ["item-1", "x"],
    ]);
  });
});
