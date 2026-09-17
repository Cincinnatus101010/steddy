import { describe, expect, it, vi } from "vitest";
import { focusRevalidate } from "./focus";

describe("focusRevalidate", () => {
  it("revalidates subscribed keys when the tab becomes visible", () => {
    const coordinator = {
      revalidate: vi.fn(async () => {}),
      getRegisteredKeys: vi.fn(() => ["user", "posts"]),
    };
    const store = {
      subscriberCount: vi.fn((key: string) => (key === "user" ? 1 : 0)),
    };
    const stop = focusRevalidate(coordinator, store);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(coordinator.revalidate).toHaveBeenCalledWith("user");
    expect(coordinator.revalidate).not.toHaveBeenCalledWith("posts");
    stop();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(coordinator.revalidate).toHaveBeenCalledTimes(1);
  });
});
