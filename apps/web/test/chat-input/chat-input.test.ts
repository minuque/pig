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
  it("turns the send button into the abort control while running", () => {
    expect(chatInputSource).toContain(":class=\"{ 'send--abort': running }\"");
    expect(chatInputSource).toContain(':disabled="running ? aborting : !sendActive"');
    expect(chatInputSource).toContain('@click="onPrimaryAction"');
    expect(workbenchMainSource).not.toContain("<SessionControlBar");
    expect(workbenchMainSource).toContain(':aborting="aborting"');
    expect(workbenchMainSource).toContain('@abort="abortSession"');
  });

  it("uses t3code-style send and abort interaction states", () => {
    expect(chatInputSource).toMatch(
      /\.send--abort\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--danger\) 90%, transparent\)/s,
    );
    expect(chatInputSource).toMatch(
      /\.send--abort:not\(:disabled\):hover\s*\{[^}]*background:\s*var\(--danger\)/s,
    );
    expect(chatInputSource).toMatch(
      /\.send:not\(:disabled\):hover\s*\{[^}]*transform:\s*scale\(1\.05\)/s,
    );
    expect(chatInputSource).toMatch(/\.send:active\s*\{[^}]*box-shadow:\s*none/s);
    expect(chatInputSource).toMatch(/\.send:disabled\s*\{[^}]*opacity:\s*0\.3/s);
  });

  it("centers the remaining scroll control above the composer", () => {
    expect(workbenchMainSource).toMatch(
      /\.session-floating-controls\s*\{[^}]*align-items:\s*center/s,
    );
  });

  it("keeps the scroll control out of the measured composer flow", () => {
    expect(workbenchMainSource).toMatch(
      /\.session-floating-controls\s*\{[^}]*position:\s*absolute[^}]*bottom:\s*calc\(100%\s*-\s*var\(--spacing-xxs\)\)/s,
    );
  });

  it("gives the scroll-to-latest control an opaque floating background", () => {
    expect(workbenchMainSource).toContain('class="floating-control scroll-latest-control"');
    expect(workbenchMainSource).toMatch(
      /\.scroll-latest-control\s*\{[^}]*background:\s*var\(--canvas-soft\)[^}]*box-shadow:\s*var\(--shadow-float\)/s,
    );
  });
});
