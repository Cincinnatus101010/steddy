import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keysShallowEqual, serializeKey } from "./key";

describe("serializeKey", () => {
  it("returns a string key unchanged", () => {
    expect(serializeKey("user/1")).toBe("user/1");
  });

  it("serializes a tuple key to JSON", () => {
    expect(serializeKey(["user", 1, true])).toBe('["user",1,true]');
  });

  it("produces the same string for equal tuples", () => {
    expect(serializeKey(["user", 1])).toBe(serializeKey(["user", 1]));
  });
});

describe("keysShallowEqual", () => {
  it("matches identical string keys", () => {
    expect(keysShallowEqual("a", "a")).toBe(true);
    expect(keysShallowEqual("a", "b")).toBe(false);
  });

  it("matches tuples by element identity, not deep equality", () => {
    expect(keysShallowEqual(["user", 1], ["user", 1])).toBe(true);
    expect(keysShallowEqual(["user", 1], ["user", 2])).toBe(false);
    const nested = { id: 1 };
    expect(keysShallowEqual(["user", nested], ["user", { id: 1 }])).toBe(false);
    expect(keysShallowEqual(["user", nested], ["user", nested])).toBe(true);
  });

  it("treats null as unequal to a key", () => {
    expect(keysShallowEqual(null, "a")).toBe(false);
    expect(keysShallowEqual(null, null)).toBe(true);
  });
});

describe("key layer isolation", () => {
  it("does not import store, coordinator, plugins, or react", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "key.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*(store|coordinator|plugins|react)/);
  });
});
