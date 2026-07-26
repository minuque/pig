import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DiagnosticSink } from "../src/diagnostics/sink.js";
import { removeTempDir, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

async function logFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((name) => name.endsWith(".jsonl"));
}

describe("DiagnosticSink", () => {
  it("logs only allowlisted safe fields and removes CRLF/control canaries", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const sink = new DiagnosticSink(dir, 10_000, 10_000);
    await sink.emit({
      code: "probe\r\ncode",
      severity: "warn",
      requestId: "request\r\nCANARY",
      component: "health",
      status: 503,
      count: 2,
      ...({ prompt: "prompt CANARY", rawUrl: "url CANARY" } as never),
    });
    const text = await readFile(join(dir, (await logFiles(dir))[0]!), "utf8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.code).toBe("probe  code");
    expect(parsed.requestId).toBe("request  CANARY");
    expect(parsed.component).toBe("health");
    expect(parsed.status).toBe(503);
    expect(parsed.prompt).toBeUndefined();
    expect(parsed.rawUrl).toBeUndefined();
    expect(text).not.toContain("\r");
    expect(text).not.toContain("\nCANARY");
  });

  it("keeps total rotated segments within the configured bound", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const sink = new DiagnosticSink(dir, 300, 100);
    for (let i = 0; i < 20; i++) {
      await sink.emit({
        code: `event-${i}`,
        severity: "info",
        component: "test",
      });
    }
    const files = await logFiles(dir);
    const sizes = await Promise.all(files.map((name) => stat(join(dir, name))));
    expect(files.length).toBeGreaterThan(1);
    expect(sizes.reduce((sum, item) => sum + item.size, 0)).toBeLessThanOrEqual(300);
  });
});
