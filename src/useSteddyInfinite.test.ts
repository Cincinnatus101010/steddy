import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { defaultCoordinator, defaultStore } from "./defaults";
import { useSteddyInfinite } from "./useSteddyInfinite";
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
});
