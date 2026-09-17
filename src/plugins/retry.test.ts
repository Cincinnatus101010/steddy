import { describe, expect, it, vi } from "vitest";
import { retryOnError } from "./retry";

describe("retryOnError", () => {
  it("retries a failing fetcher with backoff and then succeeds", async () => {
    vi.useFakeTimers();
    const coordinator = { revalidate: vi.fn(async () => {}) };
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValueOnce("ok");
    const wrapped = retryOnError(coordinator, { attempts: 3, backoff: 10 })(
      fetcher,
    );
    const signal = new AbortController().signal;
    const pending = wrapped("user", { signal });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(coordinator.revalidate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("gives up after N attempts", async () => {
    const coordinator = { revalidate: vi.fn(async () => {}) };
    const fetcher = vi.fn(async () => {
      throw new Error("nope");
    });
    const wrapped = retryOnError(coordinator, { attempts: 2, backoff: 0 })(
      fetcher,
    );
    await expect(
      wrapped("user", { signal: new AbortController().signal }),
    ).rejects.toThrow("nope");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry an aborted fetch", async () => {
    const coordinator = { revalidate: vi.fn(async () => {}) };
    const fetcher = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    const wrapped = retryOnError(coordinator, { attempts: 3, backoff: 0 })(
      fetcher,
    );
    await expect(
      wrapped("user", { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
