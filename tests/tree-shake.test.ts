/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tree-shaking", () => {
  it("omits plugin code when only useSteddy is imported", async () => {
    const result = await esbuild.build({
      stdin: {
        contents: `import { useSteddy } from "./src/index.ts"; export { useSteddy };`,
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      external: ["react"],
      logLevel: "silent",
      treeShaking: true,
    });
    const out = result.outputFiles[0]?.text ?? "";
    expect(out).toContain("useSteddy");
    expect(out).not.toContain("focusRevalidate");
    expect(out).not.toContain("reconnectRevalidate");
    expect(out).not.toContain("pollingRevalidate");
    expect(out).not.toContain("retryOnError");
    expect(out).not.toContain("ttlEvict");
    expect(out).not.toContain("useSteddyInfinite");
    expect(out).not.toContain('addEventListener("focus"');
    expect(out).not.toContain('addEventListener("online"');
    expect(out).not.toContain("setInterval");
  });
});

describe("public index", () => {
  it("re-exports plugins as named opt-in exports", () => {
    const src = readFileSync(join(root, "src/index.ts"), "utf8");
    expect(src).toMatch(/export \{[^}]*focusRevalidate/);
    expect(src).toMatch(/export \{[^}]*useSteddy/);
  });
});
