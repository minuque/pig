import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../src/features/session-nav/index.vue", import.meta.url),
  "utf8",
);

function declarationBlock(selector: string): string {
  const selectorStart = source.indexOf(selector);
  if (selectorStart < 0) throw new Error(`Missing selector: ${selector}`);
  const blockStart = source.indexOf("{", selectorStart);
  const blockEnd = source.indexOf("}", blockStart);
  return source.slice(blockStart + 1, blockEnd);
}

describe("sidebar light theme", () => {
  it("uses navigation ink tokens for sidebar icon buttons", () => {
    expect(declarationBlock(".collapse-toggle,")).toContain("color: var(--ink-muted);");
    expect(declarationBlock(".collapse-toggle:hover,")).toContain("color: var(--ink);");
    expect(declarationBlock(".settings-placeholder {")).toContain("color: var(--ink-muted);");
    expect(declarationBlock(".settings-placeholder:hover {")).toContain("color: var(--ink);");
  });
});
