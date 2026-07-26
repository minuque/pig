import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CapabilityAdapter } from "../src/capabilities.js";
import { safeDigest } from "../src/commands/ledger.js";
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
    const recoveryBody = { commandId: "recover_1", expectedRevision: 1 };
    const recoveryPayload = {
      operation: "deleteSession",
      sessionId: "session_1",
      body: recoveryBody,
    };
    const recoveryNow = recovery.store.now();
    const recoveryResult = {
      receipt: {
        commandId: "recover_1",
        disposition: "applied",
        acceptedAt: recoveryNow,
      },
      result: {
        sessionId: "session_1",
        workspaceId: "workspace_1",
        name: "Session",
        revision: 2,
        availability: "unavailable",
        updatedAt: recoveryNow,
      },
    };
    recovery.store.run(
      "INSERT INTO session_delete_ops(session_id,command_id,source_path,recycle_path,manifest_json,state,created_at,updated_at) VALUES(?,?,?,?,?,'prepared',?,?)",
      "session_1",
      "recover_1",
      recoverySource,
      recyclePath,
      JSON.stringify({
        principalId: "principal_1",
        payloadHash: safeDigest(recoveryPayload),
        payload: recoveryPayload,
        result: recoveryResult,
      }),
      recoveryNow,
      recoveryNow,
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
    const recoveredAuth = await authenticate(recoveredGateway);
    const recoveredReplay = await fetch(
      `${recoveredGateway.origin}/api/v1/sessions/session_1/commands/delete`,
      {
        method: "POST",
        headers: recoveredAuth.write,
        body: JSON.stringify(recoveryBody),
      },
    );
    expect(recoveredReplay.status).toBe(202);
    expect(await recoveredReplay.json()).toEqual(recoveryResult);
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

      const now = store.now();
      store.run(
        "INSERT INTO runs(run_id,session_id,command_id,prompt,profile_json,state,ordinal,retry_of_run_id,failure_code,revision,run_seq,created_at,updated_at) VALUES('run_1','session_1','run_command_1','pending','{}','queued',1,NULL,NULL,1,1,?,?)",
        now,
        now,
      );
      const busy = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/commands/unregister`,
        {
          method: "POST",
          headers: auth.write,
          body: JSON.stringify({
            commandId: "unregister_busy",
            expectedRevision: 1,
          }),
        },
      );
      expect(busy.status).toBe(409);
      expect((await busy.json()) as { code: string }).toMatchObject({
        code: "workspace.in_use",
      });
      store.run("UPDATE runs SET state='completed' WHERE run_id='run_1'");

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

      const [revokedWorkspace, revokedSession, revokedRun, revokedMutation, workspaces] =
        await Promise.all([
          fetch(`${gateway.origin}/api/v1/workspaces/workspace_1`, {
            headers: auth.read,
          }),
          fetch(`${gateway.origin}/api/v1/sessions/session_1`, {
            headers: auth.read,
          }),
          fetch(`${gateway.origin}/api/v1/runs/run_1`, {
            headers: auth.read,
          }),
          fetch(`${gateway.origin}/api/v1/sessions/session_1`, {
            method: "PATCH",
            headers: auth.write,
            body: JSON.stringify({
              commandId: "rename_after_revoke",
              expectedRevision: 1,
              name: "Hidden",
            }),
          }),
          fetch(`${gateway.origin}/api/v1/workspaces`, {
            headers: auth.read,
          }),
        ]);
      expect([
        revokedWorkspace.status,
        revokedSession.status,
        revokedRun.status,
        revokedMutation.status,
      ]).toEqual([404, 404, 404, 404]);
      expect((await workspaces.json()) as { items: unknown[] }).toMatchObject({
        items: [],
      });
      expect(
        store.row<{ active: number }>(
          "SELECT active FROM workspace_grants WHERE principal_id='principal_1' AND workspace_id='workspace_1'",
        )?.active,
      ).toBe(0);
      expect(
        store.row<{ active: number }>("SELECT active FROM sessions WHERE session_id='session_1'")
          ?.active,
      ).toBe(0);
    } finally {
      await gateway.close();
    }
  });
});
