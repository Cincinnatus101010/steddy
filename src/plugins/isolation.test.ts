import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginsDir = dirname(fileURLToPath(import.meta.url));

describe("plugin isolation", () => {
  it.each([
    "focus.ts",
    "reconnect.ts",
    "polling.ts",
    "retry.ts",
    "ttl.ts",
    "measure.ts",
  ])(
    "%s does not import the store",
    (file) => {
      const src = readFileSync(join(pluginsDir, file), "utf8");
      expect(src).not.toMatch(/from ["'].*store/);
      expect(src).not.toMatch(/defaultStore/);
    },
  );
});
