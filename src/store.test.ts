import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createStore, EMPTY_SNAPSHOT } from "./store";

describe("store", () => {
  it("returns undefined for a missing key", () => {
    const store = createStore();
    expect(store.get("missing")).toBeUndefined();
  });

  it("getSnapshot returns a stable empty snapshot until a key is set", () => {
    const store = createStore();
    expect(store.getSnapshot("missing")).toBe(EMPTY_SNAPSHOT);
    expect(store.getSnapshot("missing")).toBe(store.getSnapshot("other"));
  });

  it("stores and returns the exact entry object", () => {
    const store = createStore();
    const entry = {
      data: { id: 1 },
      error: undefined,
      timestamp: 10,
      isValidating: false,
    };
    store.set("user", entry);
    expect(store.get("user")).toBe(entry);
    expect(store.getSnapshot("user")).toBe(entry);
  });

  it("notifies only subscribers of the changed key", () => {
    const store = createStore();
    const user = vi.fn();
    const other = vi.fn();
    store.subscribe("user", user);
    store.subscribe("other", other);

    store.set("user", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });

    expect(user).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createStore();
    const callback = vi.fn();
    const unsubscribe = store.subscribe("user", callback);
    unsubscribe();
    store.set("user", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    expect(callback).not.toHaveBeenCalled();
    expect(store.subscriberCount("user")).toBe(0);
  });

  it("tracks subscriber counts per key", () => {
    const store = createStore();
    const a = store.subscribe("user", () => {});
    const b = store.subscribe("user", () => {});
    expect(store.subscriberCount("user")).toBe(2);
    a();
    expect(store.subscriberCount("user")).toBe(1);
    b();
    expect(store.subscriberCount("user")).toBe(0);
  });

  it("delete restores the empty snapshot and notifies", () => {
    const store = createStore();
    const callback = vi.fn();
    store.set("user", {
      data: 1,
      error: "boom",
      timestamp: 5,
      isValidating: true,
    });
    store.subscribe("user", callback);
    store.delete("user");
    expect(store.get("user")).toBeUndefined();
    expect(store.getSnapshot("user")).toBe(EMPTY_SNAPSHOT);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("clear notifies remaining subscribers and drops entries", () => {
    const store = createStore();
    const callback = vi.fn();
    store.set("user", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    store.subscribe("user", callback);
    store.clear();
    expect(store.get("user")).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("lists keys currently in the map", () => {
    const store = createStore();
    expect(store.keys()).toEqual([]);
    store.set("user", {
      data: 1,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    store.set("other", {
      data: 2,
      error: undefined,
      timestamp: 1,
      isValidating: false,
    });
    expect(store.keys().sort()).toEqual(["other", "user"]);
  });
});

describe("store layer isolation", () => {
  it("has zero knowledge of fetching, timers, focus, or coordinator", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "store.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/\bAbortController\b/);
    expect(src).not.toMatch(/\bsetInterval\b/);
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bnavigator\b/);
    expect(src).not.toMatch(/from ["'].*(coordinator|plugins|react|mutate|useLeeboard)/);
  });
});
