import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canSend } from "@features/chat-input/index.vue";

const chatInputSource = readFileSync(
  fileURLToPath(new URL("../../src/features/chat-input/index.vue", import.meta.url)),
  "utf8",
);
const workbenchMainSource = readFileSync(
  fileURLToPath(
    new URL("../../src/features/session-workbench/components/WorkbenchMain.vue", import.meta.url),
  ),
  "utf8",
);

describe("canSend", () => {
  it("有正文且未被禁用才可发送", () => {
    expect(canSend("  hi  ", false)).toBe(true);
  });

  it("空白正文拒绝", () => {
    expect(canSend("   ", false)).toBe(false);
  });

  it("外部禁用拒绝", () => {
    expect(canSend("hi", true)).toBe(false);
  });

  it("仅附件可发送", () => {
    expect(canSend("   ", false, 1)).toBe(true);
  });

  it("附件加外部禁用仍拒绝", () => {
    expect(canSend("hi", true, 2)).toBe(false);
    expect(canSend("   ", true, 1)).toBe(false);
  });
});

describe("Session control", () => {
  it("renders abort as a floating control above the docked composer", () => {
    expect(workbenchMainSource).toContain('class="session-floating-controls"');
    expect(workbenchMainSource).toContain("<SessionControlBar");
    expect(workbenchMainSource).toContain('@abort="abortSession"');
    expect(chatInputSource).not.toContain("SessionControlBar");
  });

  it("centers the floating control stack above the composer", () => {
    expect(workbenchMainSource).toMatch(
      /\.session-floating-controls\s*\{[^}]*align-items:\s*center/s,
    );
  });

  it("gives the scroll-to-latest control an opaque floating background", () => {
    expect(workbenchMainSource).toContain('class="floating-control scroll-latest-control"');
    expect(workbenchMainSource).toMatch(
      /\.scroll-latest-control\s*\{[^}]*background:\s*var\(--canvas-soft\)[^}]*box-shadow:\s*var\(--shadow-float\)/s,
    );
  });
});
