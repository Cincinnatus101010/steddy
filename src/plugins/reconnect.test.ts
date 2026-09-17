import { describe, expect, it, vi } from "vitest";
import { reconnectRevalidate } from "./reconnect";

describe("reconnectRevalidate", () => {
  it("revalidates registered keys on online and never touches a store", () => {
    const coordinator = {
      revalidate: vi.fn(async () => {}),
      getRegisteredKeys: vi.fn(() => ["user"]),
    };
    const stop = reconnectRevalidate(coordinator);
    window.dispatchEvent(new Event("online"));
    expect(coordinator.revalidate).toHaveBeenCalledWith("user");
    stop();
    window.dispatchEvent(new Event("online"));
    expect(coordinator.revalidate).toHaveBeenCalledTimes(1);
  });
});
