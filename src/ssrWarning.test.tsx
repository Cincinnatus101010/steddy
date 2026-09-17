/** @vitest-environment node */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useSteddy } from "./useSteddy";

describe("SSR default runtime", () => {
  it("warns once when useSteddy runs without SteddyProvider on the server", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function Probe() {
      useSteddy("user", async () => "ada");
      return null;
    }
    renderToString(createElement(Probe));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("SteddyProvider");
    renderToString(createElement(Probe));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
