import { describe, expect, it, vi } from "vitest";
import { focusRevalidate } from "./focus";

describe("focusRevalidate", () => {
  it("revalidates registered keys on window focus and never touches a store", () => {
    const coordinator = {
      revalidate: vi.fn(async () => {}),
      getRegisteredKeys: vi.fn(() => ["user", "posts"]),
    };
    const stop = focusRevalidate(coordinator);
    window.dispatchEvent(new Event("focus"));
    expect(coordinator.revalidate).toHaveBeenCalledWith("user");
    expect(coordinator.revalidate).toHaveBeenCalledWith("posts");
    stop();
    window.dispatchEvent(new Event("focus"));
    expect(coordinator.revalidate).toHaveBeenCalledTimes(2);
  });
});
