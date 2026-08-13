import { describe, expect, it } from "vitest";
import {
  buildSandboxedHtml,
  formatJsonContent,
  parseCsvContent,
  resolvePreviewRenderer,
} from "./filePreview";

describe("universal file preview helpers", () => {
  it("routes supported knowledge files to their browser renderer", () => {
    expect(resolvePreviewRenderer({ kind: "html" })).toBe("html");
    expect(resolvePreviewRenderer({ kind: "code", language: "sql" })).toBe("code");
    expect(resolvePreviewRenderer({ kind: "office" })).toBe("pdf");
    expect(resolvePreviewRenderer({ kind: "unknown" })).toBe("unsupported");
  });

  it("builds isolated interactive HTML with network access disabled", () => {
    const value = buildSandboxedHtml("<html><head></head><body><script>window.ok=1</script></body></html>");
    expect(value).toContain("default-src 'none'");
    expect(value).toContain("connect-src 'none'");
    expect(value).toContain("script-src 'unsafe-inline' blob:");
    expect(value).not.toContain("allow-same-origin");
  });

  it("formats valid JSON and preserves invalid JSON", () => {
    expect(formatJsonContent('{"flight":"CZ3101","delayed":true}')).toBe(
      '{\n  "flight": "CZ3101",\n  "delayed": true\n}',
    );
    expect(formatJsonContent("{invalid")).toBe("{invalid");
  });

  it("parses CSV quoted commas and line breaks", () => {
    expect(parseCsvContent('flight,reason\nCZ3101,"雷雨,流控"\nCZ3102,"机务\n检查"')).toEqual({
      columns: ["flight", "reason"],
      rows: [
        { flight: "CZ3101", reason: "雷雨,流控" },
        { flight: "CZ3102", reason: "机务\n检查" },
      ],
    });
  });
});
