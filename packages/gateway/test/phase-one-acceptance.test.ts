import { appendFile, mkdtemp, readFile, rm } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CommandId,
  ExecutionProfile,
  PiRunEvent,
  PlatformPort,
  Run,
  RunId,
  SessionId,
  Workspace,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { gatewayRequest, waitFor } from "@no-pi-no-gang/testkit";
import Gateway from "../src/index.js";
import { FakePiRuntimeAdapter } from "./fake-pi-runtime.js";

const platformPort: PlatformPort = {
  async selectWorkspaceDirectory() {
    return undefined;
  },
  async canonicalizeWorkspacePath(path) {
    return path.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  },
};

class FakePiRuntime extends FakePiRuntimeAdapter {
  profiles: ExecutionProfile[] = [
    { model: "fake-fast", thinkingLevel: "low" },
    { model: "fake-deep", thinkingLevel: "high" },
  ];
  readonly calls: Array<{
    workspaceId: WorkspaceId;
    sessionId: SessionId;
    prompt: string;
    profile?: ExecutionProfile;
    settle: (status?: "completed" | "failed" | "cancelled") => void;
  }> = [];
  readonly cancelCalls: RunId[] = [];
  readonly steerCalls: Array<{ runId: RunId; input: string }> = [];
  active = 0;
  maxActive = 0;
  emitCanaryDelta = false;

  constructor(private readonly path: string) {
    super(path);
  }

  override async capabilities() {
    return { profiles: this.profiles.map((profile) => ({ ...profile })) };
  }

  override async createRun(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    prompt: string,
    _commandId?: CommandId,
    onEvent: (event: PiRunEvent) => void = () => undefined,
    profile?: ExecutionProfile,
  ) {
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    if (this.emitCanaryDelta)
      onEvent({ type: "run.output.delta", data: { text: "DELTA_PAYLOAD_CANARY" } });
    return new Promise<{ status: "completed" | "failed" | "cancelled" }>((resolve) => {
      this.calls.push({
        workspaceId,
        sessionId,
        prompt,
        ...(profile ? { profile } : {}),
        settle: (status = "completed") => {
          this.active--;
          resolve({ status });
        },
      });
    });
  }

  override async cancelRun(runId: RunId) {
    this.cancelCalls.push(runId);
  }

  override async steerRun(runId: RunId, input: string) {
    this.steerCalls.push({ runId, input });
  }

  async seed(workspace: Workspace, count: number) {
    const records = Array.from({ length: count }, (_, index) => {
      const id = `session-${String(index + 1).padStart(3, "0")}` as SessionId;
      const date = new Date(Date.UTC(2025, 0, 1, 0, 0, index));
      return JSON.stringify({
        type: "session",
        canonicalPath: workspace.canonicalPath,
        session: {
          id,
          workspaceId: workspace.id,
          name: id,
          createdAt: date,
          updatedAt: date,
          status: "available",
        },
      });
    });
    await appendFile(this.path, `${records.join("\n")}\n`);
  }

  async appendTranscript(workspace: Workspace, sessionId: SessionId) {
    await appendFile(
      this.path,
      `${JSON.stringify({
        type: "message",
        canonicalPath: workspace.canonicalPath,
        sessionId,
        content: "TRANSCRIPT_CANARY",
        toolPayload: "TOOL_PAYLOAD_CANARY",
      })}\n`,
    );
  }
}

let gateway: Gateway | undefined;
let directory: string | undefined;

afterEach(async () => {
  await gateway?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  gateway = undefined;
  directory = undefined;
});

function request(
  port: number,
  path: string,
  credential?: string,
  body?: unknown,
  method?: "PATCH" | "DELETE",
) {
  if (!method) return gatewayRequest(port, path, credential, body);
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function start(options: { maxConcurrentRuns?: number } = {}) {
  directory ??= await mkdtemp(join(tmpdir(), "phase-one-"));
  const dbPath = join(directory, "gateway.sqlite");
  const jsonlPath = join(directory, "sessions.jsonl");
  const runtime = new FakePiRuntime(jsonlPath);
  gateway = new Gateway({
    platformPort,
    runtimeAdapter: runtime,
    bootstrapSecret: "phase-one-secret",
    dbPath,
    ...(options.maxConcurrentRuns ? { maxConcurrentRuns: options.maxConcurrentRuns } : {}),
  });
  const port = await gateway.start();
  const response = await request(port, "/api/v1/bootstrap", undefined, {
    secret: "phase-one-secret",
  });
  expect(response.status).toBe(201);
  const identity = (await response.json()) as { credential: string; identityId: string };
  return { port, runtime, dbPath, jsonlPath, ...identity };
}

async function workspace(port: number, credential: string, path = "C:/One", commandId = path) {
  const response = await request(port, "/api/v1/workspaces/confirm", credential, {
    path,
    commandId,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { workspace: Workspace }).workspace;
}

async function session(port: number, credential: string, workspaceId: string, commandId: string) {
  const path = `/api/v1/workspaces/${workspaceId}/sessions`;
  const response = await request(port, path, credential, { commandId, name: commandId });
  expect(response.status).toBe(201);
  return ((await response.json()) as { session: { id: SessionId } }).session;
}

async function run(
  port: number,
  credential: string,
  workspaceId: string,
  sessionId: SessionId,
  commandId: string,
  profile?: ExecutionProfile,
) {
  const path = `/api/v1/workspaces/${workspaceId}/sessions/${sessionId}/runs`;
  const response = await request(port, path, credential, {
    commandId,
    prompt: commandId,
    ...(profile ? { profile } : {}),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { run: Run }).run;
}

async function status(
  port: number,
  credential: string,
  workspaceId: string,
  sessionId: SessionId,
  runId: RunId,
  expected: Run["status"],
) {
  const path = `/api/v1/workspaces/${workspaceId}/sessions/${sessionId}/runs/${runId}`;
  let found: Run | undefined;
  for (let attempt = 0; attempt < 50; attempt++) {
    found = ((await (await request(port, path, credential)).json()) as { run: Run }).run;
    if (found.status === expected) return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`run ${runId} stayed ${found?.status}; expected ${expected}`);
}

function inspectSqlite(dbPath: string, canaries: string[]) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = (
    db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as Array<{ name: string; sql: string }>
  ).sort((a, b) => a.name.localeCompare(b.name));
  expect(tables.map(({ name }) => name)).toEqual([
    "local_identity",
    "session_metadata",
    "workspace",
    "workspace_access",
  ]);
  const content = JSON.stringify(
    tables.map(({ name, sql }) => ({
      name,
      sql,
      columns: db.prepare(`PRAGMA table_info(${name})`).all(),
      rows: db.prepare(`SELECT * FROM ${name}`).all(),
    })),
  );
  db.close();
  expect(content).not.toMatch(/prompt|transcript|delta|tool.?payload/i);
  const bytes = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]
    .filter(existsSync)
    .map((path) => readFileSync(path).toString("latin1"))
    .join("");
  for (const canary of canaries) {
    expect(content).not.toContain(canary);
    expect(bytes).not.toContain(canary);
  }
}

describe("Phase 1 Gateway acceptance", () => {
  it("persists identity and canonical workspaces, deduplicates grants, and gates revoked resources", async () => {
    let started = await start();
    const firstIdentity = started.identityId;
    const one = await workspace(started.port, started.credential, "C:/One/", "workspace-one");
    const duplicate = await workspace(
      started.port,
      started.credential,
      "c:\\one",
      "workspace-one-again",
    );
    const two = await workspace(started.port, started.credential, "C:/Two", "workspace-two");
    expect(duplicate.id).toBe(one.id);
    const tombstone = await session(started.port, started.credential, one.id, "tombstone");
    const live = await session(started.port, started.credential, one.id, "live");
    await session(started.port, started.credential, two.id, "other");
    const tombstonePath = `/api/v1/workspaces/${one.id}/sessions/${tombstone.id}`;
    expect(
      (await request(started.port, tombstonePath, started.credential, { confirm: true }, "DELETE"))
        .status,
    ).toBe(200);

    await gateway!.stop();
    gateway = undefined;
    started = await start();
    expect(started.identityId).toBe(firstIdentity);
    const listed = (await (
      await request(started.port, "/api/v1/workspaces", started.credential)
    ).json()) as { workspaces: Workspace[] };
    expect(listed.workspaces.map(({ id }) => id)).toEqual([one.id, two.id]);
    expect(
      (await workspace(started.port, started.credential, "C:/ONE", "dedupe-after-restart")).id,
    ).toBe(one.id);
    expect(
      (await request(started.port, tombstonePath, started.credential, { confirm: true }, "DELETE"))
        .status,
    ).toBe(200);

    expect(
      (
        await request(
          started.port,
          `/api/v1/workspaces/${one.id}`,
          started.credential,
          { confirm: true },
          "DELETE",
        )
      ).status,
    ).toBe(204);
    for (const [path, body] of [
      [`/api/v1/workspaces/${one.id}`, undefined],
      [`/api/v1/workspaces/${one.id}/sessions`, { commandId: "denied-session" }],
      [
        `/api/v1/workspaces/${one.id}/sessions/${live.id}/runs`,
        { commandId: "denied-run", prompt: "denied" },
      ],
      [tombstonePath, { confirm: true }],
    ] as const) {
      const response = body?.confirm
        ? await request(started.port, path, started.credential, body, "DELETE")
        : await request(started.port, path, started.credential, body);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "WORKSPACE_ACCESS_DENIED" });
    }
    expect(
      (await request(started.port, `/api/v1/workspaces/${two.id}/sessions`, started.credential))
        .status,
    ).toBe(200);
  });

  it("paginates deterministically, finds sessions beyond 100, and persists rename/delete", async () => {
    let started = await start();
    const one = await workspace(started.port, started.credential);
    await started.runtime.seed(one, 105);
    const base = `/api/v1/workspaces/${one.id}/sessions`;
    const page = async (suffix: string) =>
      (await (await request(started.port, `${base}${suffix}`, started.credential)).json()) as {
        sessions: Array<{ id: SessionId; name?: string }>;
        nextCursor?: string;
      };
    const first = await page("?limit=40");
    const repeated = await page("?limit=40");
    await request(
      started.port,
      `${base}/session-066`,
      started.credential,
      { confirm: true },
      "DELETE",
    );
    const second = await page(`?limit=40&cursor=${first.nextCursor}`);
    const third = await page(`?limit=40&cursor=${second.nextCursor}`);
    expect(repeated).toEqual(first);
    expect(first.sessions.map(({ id }) => id)).toEqual(
      Array.from({ length: 40 }, (_, i) => `session-${String(105 - i).padStart(3, "0")}`),
    );
    expect(
      new Set([...first.sessions, ...second.sessions, ...third.sessions].map(({ id }) => id)).size,
    ).toBe(105);
    expect(second.sessions[0]?.id).toBe("session-065");
    const invalidCursor = await request(
      started.port,
      `${base}?cursor=deleted-or-unknown-id`,
      started.credential,
    );
    expect(invalidCursor.status).toBe(400);
    expect(await invalidCursor.json()).toEqual({ code: "INVALID_SESSION_CURSOR" });
    expect(third.nextCursor).toBeUndefined();

    const old = `${base}/session-001`;
    expect((await request(started.port, old, started.credential)).status).toBe(200);
    expect(
      (
        await request(
          started.port,
          old,
          started.credential,
          { name: "Renamed", confirm: true },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    const deleted = `${base}/session-002`;
    for (let retry = 0; retry < 2; retry++)
      expect(
        (await request(started.port, deleted, started.credential, { confirm: true }, "DELETE"))
          .status,
      ).toBe(200);

    await gateway!.stop();
    gateway = undefined;
    started = await start();
    expect(
      (
        (await (await request(started.port, old, started.credential)).json()) as {
          session: { name: string };
        }
      ).session.name,
    ).toBe("Renamed");
    expect((await request(started.port, deleted, started.credential)).status).toBe(404);
    expect(
      (await request(started.port, deleted, started.credential, { confirm: true }, "DELETE"))
        .status,
    ).toBe(200);
  });

  it("isolates metadata for identical Pi session IDs by workspace", async () => {
    const started = await start();
    const one = await workspace(started.port, started.credential, "C:/One");
    const two = await workspace(started.port, started.credential, "C:/Two");
    await started.runtime.seed(one, 1);
    await started.runtime.seed(two, 1);
    const first = `/api/v1/workspaces/${one.id}/sessions/session-001`;
    const second = `/api/v1/workspaces/${two.id}/sessions/session-001`;

    await request(
      started.port,
      first,
      started.credential,
      { name: "Only one", confirm: true },
      "PATCH",
    );
    expect(
      (
        (await (await request(started.port, second, started.credential)).json()) as {
          session: { name: string };
        }
      ).session.name,
    ).toBe("session-001");
    const [runOne, runTwo] = await Promise.all([
      run(started.port, started.credential, one.id, "session-001" as SessionId, "one-run"),
      run(started.port, started.credential, two.id, "session-001" as SessionId, "two-run"),
    ]);
    await waitFor(() => started.runtime.calls.length === 2);
    expect(started.runtime.calls.map(({ workspaceId }) => workspaceId).sort()).toEqual(
      [one.id, two.id].sort(),
    );
    started.runtime.calls[0]!.settle();
    started.runtime.calls[1]!.settle();
    await status(
      started.port,
      started.credential,
      one.id,
      "session-001" as SessionId,
      runOne.id,
      "completed",
    );
    await status(
      started.port,
      started.credential,
      two.id,
      "session-001" as SessionId,
      runTwo.id,
      "completed",
    );

    await request(started.port, first, started.credential, { confirm: true }, "DELETE");
    expect((await request(started.port, second, started.credential)).status).toBe(200);
  });

  it("uses runtime capabilities, rejects invalid profiles, freezes queued profiles, and keeps SQLite metadata-only", async () => {
    const started = await start({ maxConcurrentRuns: 1 });
    const one = await workspace(started.port, started.credential);
    const current = await session(started.port, started.credential, one.id, "profile-session");
    expect(
      await (await request(started.port, "/api/v1/capabilities", started.credential)).json(),
    ).toEqual({
      profiles: started.runtime.profiles,
    });
    const runs = `/api/v1/workspaces/${one.id}/sessions/${current.id}/runs`;
    const invalid = await request(started.port, runs, started.credential, {
      commandId: "invalid-profile",
      prompt: "invalid",
      profile: { model: "missing", thinkingLevel: "none" },
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: "INVALID_EXECUTION_PROFILE" });

    started.runtime.emitCanaryDelta = true;
    const first = await run(
      started.port,
      started.credential,
      one.id,
      current.id,
      "FULL_PROMPT_CANARY",
      started.runtime.profiles[0],
    );
    const frozen = { ...started.runtime.profiles[1]! };
    const queued = await run(
      started.port,
      started.credential,
      one.id,
      current.id,
      "queued-profile",
      frozen,
    );
    expect(queued).toMatchObject({ status: "queued", profile: frozen });
    started.runtime.profiles = [{ model: "changed", thinkingLevel: "changed" }];
    started.runtime.calls[0]!.settle();
    await waitFor(() => started.runtime.calls.length === 2);
    expect(started.runtime.calls[1]!.profile).toEqual(frozen);
    started.runtime.calls[1]!.settle();
    await status(started.port, started.credential, one.id, current.id, first.id, "completed");
    await status(started.port, started.credential, one.id, current.id, queued.id, "completed");
    await started.runtime.appendTranscript(one, current.id);

    await gateway!.stop();
    gateway = undefined;
    inspectSqlite(started.dbPath, [
      "FULL_PROMPT_CANARY",
      "TRANSCRIPT_CANARY",
      "DELTA_PAYLOAD_CANARY",
      "TOOL_PAYLOAD_CANARY",
    ]);
    expect(await readFile(started.jsonlPath, "utf8")).toContain("TRANSCRIPT_CANARY");
  });

  it("runs FIFO per session and parallel across sessions up to the cap, then releases capacity", async () => {
    const started = await start({ maxConcurrentRuns: 2 });
    const one = await workspace(started.port, started.credential);
    const [a, b, c] = (await Promise.all(
      ["session-a", "session-b", "session-c"].map((id) =>
        session(started.port, started.credential, one.id, id),
      ),
    )) as [{ id: SessionId }, { id: SessionId }, { id: SessionId }];
    await run(started.port, started.credential, one.id, a.id, "a-1");
    await run(started.port, started.credential, one.id, a.id, "a-2");
    await run(started.port, started.credential, one.id, b.id, "b-1");
    await run(started.port, started.credential, one.id, c.id, "c-1");
    await waitFor(() => started.runtime.calls.length === 2);
    expect(started.runtime.calls.map(({ prompt }) => prompt)).toEqual(["a-1", "b-1"]);
    expect(started.runtime.maxActive).toBe(2);

    started.runtime.calls.find(({ prompt }) => prompt === "b-1")!.settle();
    await waitFor(() => started.runtime.calls.some(({ prompt }) => prompt === "c-1"));
    expect(started.runtime.active).toBe(2);
    started.runtime.calls.find(({ prompt }) => prompt === "a-1")!.settle();
    await waitFor(() => started.runtime.calls.some(({ prompt }) => prompt === "a-2"));
    expect(started.runtime.calls.map(({ prompt }) => prompt)).toEqual(["a-1", "b-1", "c-1", "a-2"]);
    expect(started.runtime.maxActive).toBe(2);
    started.runtime.calls.find(({ prompt }) => prompt === "c-1")!.settle();
    started.runtime.calls.find(({ prompt }) => prompt === "a-2")!.settle();
  });

  it("cancels queued without Pi and active through cancelling exactly once", async () => {
    const started = await start({ maxConcurrentRuns: 1 });
    const one = await workspace(started.port, started.credential);
    const activeSession = await session(started.port, started.credential, one.id, "active");
    const queuedSession = await session(started.port, started.credential, one.id, "queued");
    const active = await run(
      started.port,
      started.credential,
      one.id,
      activeSession.id,
      "active-run",
    );
    const queued = await run(
      started.port,
      started.credential,
      one.id,
      queuedSession.id,
      "queued-run",
    );
    const cancel = (sessionId: SessionId, runId: RunId, commandId: string) =>
      request(
        started.port,
        `/api/v1/workspaces/${one.id}/sessions/${sessionId}/runs/${runId}/cancel`,
        started.credential,
        { commandId },
      );

    expect(
      ((await (await cancel(queuedSession.id, queued.id, "cancel-queued")).json()) as { run: Run })
        .run.status,
    ).toBe("cancelled");
    expect(started.runtime.calls.map(({ prompt }) => prompt)).toEqual(["active-run"]);
    expect(started.runtime.cancelCalls).toHaveLength(0);

    expect(
      ((await (await cancel(activeSession.id, active.id, "cancel-active")).json()) as { run: Run })
        .run.status,
    ).toBe("cancelling");
    await cancel(activeSession.id, active.id, "cancel-active");
    await cancel(activeSession.id, active.id, "cancel-active-again");
    expect(started.runtime.cancelCalls).toEqual([active.id]);
    started.runtime.calls[0]!.settle("cancelled");
    await status(
      started.port,
      started.credential,
      one.id,
      activeSession.id,
      active.id,
      "cancelled",
    );
    expect(started.runtime.cancelCalls).toEqual([active.id]);
  });

  it("steers only the exact current running run and never creates a replacement Run", async () => {
    const started = await start({ maxConcurrentRuns: 1 });
    const one = await workspace(started.port, started.credential);
    const currentSession = await session(started.port, started.credential, one.id, "current");
    const otherSession = await session(started.port, started.credential, one.id, "other");
    const current = await run(
      started.port,
      started.credential,
      one.id,
      currentSession.id,
      "current-run",
    );
    const queued = await run(
      started.port,
      started.credential,
      one.id,
      otherSession.id,
      "queued-run",
    );
    await status(
      started.port,
      started.credential,
      one.id,
      currentSession.id,
      current.id,
      "running",
    );
    const steer = (sessionId: SessionId, runId: RunId, input: string) =>
      request(
        started.port,
        `/api/v1/workspaces/${one.id}/sessions/${sessionId}/runs/${runId}/steer`,
        started.credential,
        { input },
      );

    expect((await steer(currentSession.id, current.id, "exact")).status).toBe(200);
    const queuedSteer = await steer(otherSession.id, queued.id, "queued");
    expect(queuedSteer.status).toBe(409);
    expect(await queuedSteer.json()).toEqual({ code: "INVALID_RUN_STATE" });
    const wrong = await steer(otherSession.id, current.id, "wrong-session");
    expect(wrong.status).toBe(404);
    expect(await wrong.json()).toEqual({ code: "RUN_NOT_FOUND" });

    started.runtime.calls[0]!.settle();
    await status(
      started.port,
      started.credential,
      one.id,
      currentSession.id,
      current.id,
      "completed",
    );
    const terminal = await steer(currentSession.id, current.id, "terminal");
    expect(terminal.status).toBe(409);
    expect(await terminal.json()).toEqual({ code: "INVALID_RUN_STATE" });
    await waitFor(() => started.runtime.calls.length === 2);
    expect(started.runtime.steerCalls).toEqual([{ runId: current.id, input: "exact" }]);
    expect(started.runtime.calls.map(({ prompt }) => prompt)).toEqual([
      "current-run",
      "queued-run",
    ]);
    started.runtime.calls[1]!.settle();
  });
});
