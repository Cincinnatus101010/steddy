import { describe, expect, it, vi } from "vitest";
import { pollingRevalidate } from "./polling";

describe("pollingRevalidate", () => {
  it("revalidates a key on an interval and clears on stop", () => {
    vi.useFakeTimers();
    const coordinator = {
      revalidate: vi.fn(async () => {}),
    };
    const stop = pollingRevalidate(coordinator, "user", 1000);
    expect(coordinator.revalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(coordinator.revalidate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(coordinator.revalidate).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(5000);
    expect(coordinator.revalidate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
