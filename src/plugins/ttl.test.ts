import { describe, expect, it, vi } from "vitest";
import { ttlEvict } from "./ttl";

describe("ttlEvict", () => {
  it("evicts immediately and on the interval", () => {
    vi.useFakeTimers();
    const coordinator = {
      evict: vi.fn(() => []),
    };
    const stop = ttlEvict(coordinator, { maxAge: 1000, interval: 500 });
    expect(coordinator.evict).toHaveBeenCalledTimes(1);
    expect(coordinator.evict).toHaveBeenCalledWith({ maxAge: 1000 });
    vi.advanceTimersByTime(500);
    expect(coordinator.evict).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(2000);
    expect(coordinator.evict).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
