import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHttpGateway } from "../src/server.js";
import { openStore, removeTempDir, rootsFor, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

describe("real loopback gateway", () => {
  it("bootstraps, registers a workspace, and rejects cross-site/OPTIONS requests without CORS", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const workspace = join(dir, "workspace");
    const publicDir = join(dir, "public");
    await mkdir(workspace);
    await mkdir(publicDir);
    await writeFile(join(publicDir, "index.html"), "<main>workbench</main>");
    const roots = rootsFor(dir);
    await mkdir(join(dir, "data"), { recursive: true });
    const { db, store } = await openStore(roots.database);
    const gateway = await createHttpGateway(store, roots, workspace, publicDir);
    try {
      const origin = gateway.origin;
      const secret = new URL(gateway.bootstrapUrl).hash.slice("#bootstrap=".length);
      const exchanged = await fetch(`${origin}/api/v1/gateway-auth/bootstrap`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      expect(exchanged.status).toBe(200);
      const cookie = exchanged.headers.get("set-cookie");
      expect(cookie).toMatch(/^npng_session=/);
      const csrf = ((await exchanged.json()) as { csrfToken: string }).csrfToken;

      const bootstrapped = await fetch(`${origin}/api/v1/bootstrap`, {
        headers: { origin, cookie: cookie!.split(";")[0]! },
      });
      expect(bootstrapped.status).toBe(200);
      expect(
        ((await bootstrapped.json()) as { proposedWorkspacePath?: string }).proposedWorkspacePath,
      ).toBe(workspace);

      const preview = await fetch(`${origin}/api/v1/workspace-registration-previews`, {
        method: "POST",
        headers: {
          origin,
          cookie: cookie!.split(";")[0]!,
          "x-csrf-token": csrf,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          commandId: "cmd_preview",
          candidatePath: workspace,
        }),
      });
      expect(preview.status).toBe(201);
      const previewResult = ((await preview.json()) as { result: { previewId: string } }).result;
      const created = await fetch(`${origin}/api/v1/workspaces`, {
        method: "POST",
        headers: {
          origin,
          cookie: cookie!.split(";")[0]!,
          "x-csrf-token": csrf,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          commandId: "cmd_workspace",
          previewId: previewResult.previewId,
          name: "Workspace",
        }),
      });
      expect(created.status).toBe(201);
      expect(
        ((await created.json()) as { result: { canonicalRoot: string } }).result.canonicalRoot,
      ).toBe(workspace);

      const crossSite = await fetch(`${origin}/api/v1/bootstrap`, {
        headers: {
          origin: "https://evil.example",
          cookie: cookie!.split(";")[0]!,
        },
      });
      expect(crossSite.status).toBe(403);
      const options = await fetch(`${origin}/api/v1/bootstrap`, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      });
      expect(options.status).toBe(404);
      expect(options.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await gateway.close();
    }
  });
});
