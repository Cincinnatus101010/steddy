import type { Key } from "./types";

export function serializeKey(key: Key): string {
  if (typeof key === "string") {
    return key;
  }
  return JSON.stringify(key);
}

export function keysShallowEqual(a: Key | null, b: Key | null): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }
  return true;
}
