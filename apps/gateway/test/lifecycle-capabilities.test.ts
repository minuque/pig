import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CapabilityAdapter } from "../src/capabilities.js";
import { createHttpGateway } from "../src/server.js";
import {
  addPrincipalWorkspaceSession,
  openStore,
  removeTempDir,
  rootsFor,
  tempDir,
} from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

const capabilities: CapabilityAdapter = {
  async models() {
    return [];
  },
  async providerAuth() {
    return [];
  },
  async setApiKey() {
    throw new Error("not used");
  },
  async deleteCredential() {
    throw new Error("not used");
  },
  async login() {
    throw new Error("not used");
  },
};

async function authenticate(gateway: Awaited<ReturnType<typeof createHttpGateway>>) {
  const secret = new URL(gateway.bootstrapUrl).hash.slice("#bootstrap=".length);
  const response = await fetch(`${gateway.origin}/api/v1/gateway-auth/bootstrap`, {
    method: "POST",
    headers: { origin: gateway.origin, "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const csrfToken = ((await response.json()) as { csrfToken: string }).csrfToken;
  return {
    read: { origin: gateway.origin, cookie },
    write: {
      origin: gateway.origin,
      cookie,
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
  };
}

describe("destructive capability lifecycle", () => {
  it("recycles a session, replays delete idempotently, and recovers a prepared delete at startup", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const roots = rootsFor(dir);
    await mkdir(roots.data, { recursive: true });
    const source = join(dir, "session.jsonl");
    await writeFile(source, '{"type":"session","id":"session_1","cwd":"/safe"}\n');
    const { store } = await openStore(roots.database);
    addPrincipalWorkspaceSession(store, source);
    const gateway = await createHttpGateway(store, roots, undefined, dir, {
      capabilities,
    });
    const auth = await authenticate(gateway);
    const body = JSON.stringify({ commandId: "delete_1", expectedRevision: 1 });
    const first = await fetch(`${gateway.origin}/api/v1/sessions/session_1/commands/delete`, {
      method: "POST",
      headers: auth.write,
      body,
    });
    expect(first.status).toBe(202);
    const firstJson = await first.json();
    const replay = await fetch(`${gateway.origin}/api/v1/sessions/session_1/commands/delete`, {
      method: "POST",
      headers: auth.write,
      body,
    });
    expect(replay.status).toBe(202);
    expect(await replay.json()).toEqual(firstJson);
    expect(
      store.row<{ state: string }>(
        "SELECT state FROM session_delete_ops WHERE session_id='session_1'",
      )?.state,
    ).toBe("committed");
    await gateway.close();

    const recoveryDir = await tempDir();
    cleanups.push(recoveryDir);
    const recoveryRoots = rootsFor(recoveryDir);
    await mkdir(recoveryRoots.data, { recursive: true });
    const recoverySource = join(recoveryDir, "recover.jsonl");
    const recyclePath = `${recoverySource}.recycle-session_1-recover_1`;
    await writeFile(recoverySource, '{"type":"session","id":"session_1","cwd":"/safe"}\n');
    const recovery = await openStore(recoveryRoots.database);
    addPrincipalWorkspaceSession(recovery.store, recoverySource);
    recovery.store.run(
      "INSERT INTO session_delete_ops(session_id,command_id,source_path,recycle_path,manifest_json,state,created_at,updated_at) VALUES(?,?,?,?,?,'prepared',?,?)",
      "session_1",
      "recover_1",
      recoverySource,
      recyclePath,
      "{}",
      recovery.store.now(),
      recovery.store.now(),
    );
    await rename(recoverySource, recyclePath);
    const recoveredGateway = await createHttpGateway(
      recovery.store,
      recoveryRoots,
      undefined,
      recoveryDir,
      { capabilities },
    );
    expect(
      recovery.store.row<{ state: string }>(
        "SELECT state FROM session_delete_ops WHERE session_id='session_1'",
      )?.state,
    ).toBe("committed");
    expect(
      recovery.store.row<{ active: number }>(
        "SELECT active FROM sessions WHERE session_id='session_1'",
      )?.active,
    ).toBe(0);
    await recoveredGateway.close();
  });

  it("enforces unregister revision, replays the command, and immediately revokes resources", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const roots = rootsFor(dir);
    await mkdir(roots.data, { recursive: true });
    const source = join(dir, "session.jsonl");
    await writeFile(source, '{"type":"session","id":"session_1","cwd":"/safe"}\n');
    const { store } = await openStore(roots.database);
    addPrincipalWorkspaceSession(store, source);
    const gateway = await createHttpGateway(store, roots, undefined, dir, {
      capabilities,
    });
    try {
      const auth = await authenticate(gateway);
      const stale = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/commands/unregister`,
        {
          method: "POST",
          headers: auth.write,
          body: JSON.stringify({
            commandId: "unregister_stale",
            expectedRevision: 0,
          }),
        },
      );
      expect(stale.status).toBe(409);
      expect((await stale.json()) as { code: string }).toMatchObject({
        code: "workspace.revision_conflict",
      });

      const body = JSON.stringify({
        commandId: "unregister_1",
        expectedRevision: 1,
      });
      const first = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/commands/unregister`,
        {
          method: "POST",
          headers: auth.write,
          body,
        },
      );
      expect(first.status).toBe(200);
      const firstJson = await first.json();
      const replay = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/commands/unregister`,
        {
          method: "POST",
          headers: auth.write,
          body,
        },
      );
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual(firstJson);

      const revoked = await fetch(`${gateway.origin}/api/v1/sessions/session_1`, {
        headers: auth.read,
      });
      expect(revoked.status).toBe(404);
      expect(
        store.row<{ active: number }>("SELECT active FROM sessions WHERE session_id='session_1'")
          ?.active,
      ).toBe(0);
    } finally {
      await gateway.close();
    }
  });
});
