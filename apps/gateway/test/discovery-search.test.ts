import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import type { CapabilityAdapter } from "../src/capabilities.js";
import { SessionProjectionCoordinator } from "../src/projection/coordinator.js";
import { createHttpGateway } from "../src/server.js";
import { openStore, removeTempDir, rootsFor, tempDir } from "./helpers.js";

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

async function authenticate(
  gateway: Awaited<ReturnType<typeof createHttpGateway>>,
) {
  const secret = new URL(gateway.bootstrapUrl).hash.slice("#bootstrap=".length);
  const response = await fetch(
    `${gateway.origin}/api/v1/gateway-auth/bootstrap`,
    {
      method: "POST",
      headers: { origin: gateway.origin, "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    },
  );
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

describe("session discovery and search", () => {
  it("reconciles Pi sessions, scopes FTS to the workspace, and pages with stable cursors", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const roots = rootsFor(dir);
    const agentDir = join(dir, "agent");
    const sessionDir = join(agentDir, "sessions");
    const workspace1 = join(dir, "workspace-1");
    const workspace2 = join(dir, "workspace-2");
    await Promise.all([
      mkdir(roots.data, { recursive: true }),
      mkdir(sessionDir, { recursive: true }),
      mkdir(workspace1),
      mkdir(workspace2),
    ]);
    const { db, store } = await openStore(roots.database);
    let gateway: Awaited<ReturnType<typeof createHttpGateway>> | undefined;
    try {
      const now = "2025-01-01T00:00:00.000Z";
      store.run(
        "INSERT INTO principals(principal_id,display_name,created_at) VALUES('principal_1','User',?)",
        now,
      );
      store.run(
        "INSERT INTO workspaces(workspace_id,principal_id,name,canonical_root,updated_at) VALUES('workspace_1','principal_1','One',?,?)",
        workspace1,
        now,
      );
      store.run(
        "INSERT INTO workspaces(workspace_id,principal_id,name,canonical_root,updated_at) VALUES('workspace_2','principal_1','Two',?,?)",
        workspace2,
        now,
      );

      const create = (cwd: string, name: string, text: string) => {
        const manager = SessionManager.create(cwd, sessionDir);
        manager.appendSessionInfo(name);
        manager.appendMessage({
          role: "user",
          content: text,
          timestamp: Date.now(),
        });
        manager.appendMessage({
          role: "assistant",
          content: [{ type: "text", text: "Fixture response" }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "fixture-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        });
        return manager.getSessionId();
      };
      const firstId = create(workspace1, "First", "alpha first visible");
      const secondId = create(workspace1, "Second", "alpha second visible");
      create(workspace2, "Foreign", "alpha foreign visible");

      const coordinator = new SessionProjectionCoordinator(store, agentDir);
      await coordinator.reconcile();
      await coordinator.reconcile();
      expect(
        store.row<{ count: number }>("SELECT count(*) AS count FROM sessions")
          ?.count,
      ).toBe(3);
      expect(
        store.row<{ count: number }>(
          "SELECT count(*) AS count FROM sessions WHERE workspace_id='workspace_1'",
        )?.count,
      ).toBe(2);
      store.run(
        "UPDATE sessions SET updated_at='2025-01-03T00:00:00.000Z' WHERE session_id=?",
        firstId,
      );
      store.run(
        "UPDATE sessions SET updated_at='2025-01-02T00:00:00.000Z' WHERE session_id=?",
        secondId,
      );

      gateway = await createHttpGateway(store, roots, undefined, dir, {
        capabilities,
      });
      const cookie = await authenticate(gateway);
      const headers = { origin: gateway.origin, cookie };
      const first = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/sessions?search=alpha&limit=1`,
        { headers },
      );
      expect(first.status).toBe(200);
      const firstPage = (await first.json()) as {
        items: Array<{ sessionId: string; workspaceId: string }>;
        nextCursor: string | null;
      };
      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.items[0]!.workspaceId).toBe("workspace_1");
      expect(firstPage.nextCursor).not.toBeNull();

      const second = await fetch(
        `${gateway.origin}/api/v1/workspaces/workspace_1/sessions?search=alpha&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
        { headers },
      );
      const secondPage = (await second.json()) as {
        items: Array<{ sessionId: string; workspaceId: string }>;
        nextCursor: string | null;
      };
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.items[0]!.workspaceId).toBe("workspace_1");
      expect(secondPage.items[0]!.sessionId).not.toBe(
        firstPage.items[0]!.sessionId,
      );
      expect(secondPage.nextCursor).toBeNull();
    } finally {
      if (gateway) await gateway.close();
      else db.close();
    }
  });
});
