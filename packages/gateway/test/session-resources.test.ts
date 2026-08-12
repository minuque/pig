import { appendFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, describe, expect, it } from "vitest";

import type { PlatformPort } from "@pig/contracts";
import Gateway from "../src/index.js";
import { FakePiRuntimeAdapter } from "./fake-pi-runtime.js";
import { gatewayRequest as request } from "@pig/testkit";

const platformPort: PlatformPort = {
  async selectWorkspaceDirectory() {
    return undefined;
  },
  async canonicalizeWorkspacePath(path) {
    return path.toLowerCase();
  },
};

let gateway: Gateway | undefined;
let directory: string | undefined;
afterEach(async () => {
  await gateway?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  gateway = undefined;
  directory = undefined;
});

describe("session resources", () => {
  it("gates, creates idempotently, rescans, opens, and reads JSONL after restart", async () => {
    directory = await mkdtemp(join(tmpdir(), "gateway-sessions-"));
    const jsonlPath = join(directory, "sessions.jsonl");
    gateway = new Gateway({
      platformPort,
      runtimeAdapter: new FakePiRuntimeAdapter(jsonlPath),
      bootstrapSecret: "secret",
    });
    let port = await gateway.start();

    const bootstrap = await request(port, "/api/v1/bootstrap", undefined, { secret: "secret" });
    const { credential } = (await bootstrap.json()) as { credential: string };
    const confirmed = await request(port, "/api/v1/workspaces/confirm", credential, {
      path: "C:/Project",
      commandId: "workspace-command",
    });
    const { workspace } = (await confirmed.json()) as { workspace: { id: string } };
    const sessionsPath = `/api/v1/workspaces/${workspace.id}/sessions`;

    expect((await request(port, sessionsPath)).status).toBe(401);
    expect((await request(port, "/api/v1/workspaces/other/sessions", credential)).status).toBe(403);

    const created = await request(port, sessionsPath, credential, {
      commandId: "session-command",
      name: "First",
    });
    expect(created.status).toBe(201);
    const first = (await created.json()) as { session: { id: string; workspaceId: string } };
    expect(first.session.workspaceId).toBe(workspace.id);
    expect(first.session).not.toHaveProperty("piSession");

    const retry = await request(port, sessionsPath, credential, {
      commandId: "session-command",
      name: "First",
    });
    expect((await retry.json()) as unknown).toEqual(first);
    expect(
      (
        await request(port, sessionsPath, credential, {
          commandId: "session-command",
          name: "Changed",
        })
      ).status,
    ).toBe(409);

    const transcriptEntry = {
      type: "message",
      canonicalPath: "c:/project",
      sessionId: first.session.id,
      role: "assistant",
      content: "durable answer",
    };
    await appendFile(jsonlPath, `${JSON.stringify(transcriptEntry)}\n`);

    await gateway.stop();
    port = await gateway.start();

    const list = await request(port, sessionsPath, credential);
    expect((await list.json()) as unknown).toMatchObject({ sessions: [first.session] });
    const sessionPath = `${sessionsPath}/${first.session.id}`;
    expect((await request(port, sessionPath)).status).toBe(401);
    expect(
      (await request(port, `/api/v1/workspaces/other/sessions/${first.session.id}`, credential))
        .status,
    ).toBe(403);
    expect((await request(port, `${sessionPath}/transcript`)).status).toBe(401);
    expect((await request(port, sessionPath, credential)).status).toBe(200);
    expect(await (await request(port, `${sessionPath}/transcript`, credential)).json()).toEqual({
      transcript: [transcriptEntry],
    });

    const laterEntry = { ...transcriptEntry, content: "read fresh" };
    await appendFile(jsonlPath, `${JSON.stringify(laterEntry)}\n`);
    expect(await (await request(port, `${sessionPath}/transcript`, credential)).json()).toEqual({
      transcript: [transcriptEntry, laterEntry],
    });
  });
});
