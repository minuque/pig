import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { GatewayAccess } from "../src/access/access.js";
import { openStore, removeTempDir, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

describe("GatewayAccess", () => {
  it("exchanges the bootstrap secret once and issues a one-shot cookie", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    try {
      const access = new GatewayAccess(store, "http://127.0.0.1:1234", undefined, () => 1_000);
      const csrf = access.exchange(access.bootstrapSecret);
      expect(csrf).toHaveLength(43);
      expect(access.cookie()).toMatch(/^npng_session=.+; HttpOnly; SameSite=Strict; Path=\/api$/);
      expect(() => access.cookie()).toThrow("auth_unavailable");
      expect(() => access.exchange(access.bootstrapSecret)).toThrowError(
        expect.objectContaining({ code: "auth.bootstrap_invalid" }),
      );
    } finally {
      db.close();
    }
  });

  it("requires canonical real paths and rejects traversal outside the root", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const root = join(dir, "root");
    const child = join(root, "child");
    const outside = join(dir, "outside");
    await mkdir(child, { recursive: true });
    await mkdir(outside);
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    try {
      const access = new GatewayAccess(store, "http://127.0.0.1:1234");
      expect(await access.contains(root, child)).toBe(true);
      expect(await access.contains(root, join(root, "child", ".."))).toBe(true);
      expect(await access.contains(root, outside)).toBe(false);
      await expect(access.canonical(join(dir, "missing"))).rejects.toMatchObject({
        code: "workspace.path_invalid",
      });
    } finally {
      db.close();
    }
  });
});
