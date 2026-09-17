import { describe, expect, it, vi } from "vitest";
import { createCoordinator } from "../coordinator";
import { createStore } from "../store";
import { attachDefaults } from "./attachDefaults";

describe("attachDefaults", () => {
  it("returns a cleanup that stops every wired plugin", () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const stop = attachDefaults(coordinator, store, {
      ttl: { maxAge: 1, interval: 60_000 },
    });
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });
});
