import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { PlatformPort } from "@no-pi-no-gang/contracts";
import { FakePiRuntimeAdapter } from "@no-pi-no-gang/testkit";
import { afterEach, describe, expect, it } from "vitest";
import Gateway, { PiRuntimeAdapterImpl } from "../src/index.js";

/** 写一个 Pi 会话 JSONL，用公开 API（SessionManager）并覆盖 header 时间戳以控制 modified */
async function writeSession(cwd: string, sessionDir: string, modified: Date, name = "Session") {
  await mkdir(cwd, { recursive: true });
  const manager = SessionManager.create(cwd, sessionDir);
  manager.appendSessionInfo(name);
  const header = manager.getHeader() as { timestamp: string };
  header.timestamp = modified.toISOString();
  await writeFile(
    manager.getSessionFile()!,
    `${[header, ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    { flag: "wx" },
  );
}

describe("PiRuntimeAdapterImpl.discoverCandidateWorkspaces", () => {
  it("扫描 sessionDir：跳过空/失效 cwd、按 canonicalPath 去重、modified 降序", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-candidates-"));
    try {
      const sessionsDir = join(directory, "sessions");
      const adapter = new PiRuntimeAdapterImpl(undefined, undefined, sessionsDir);

      const shared = join(directory, "shared");
      await writeSession(shared, sessionsDir, new Date("2024-01-03T00:00:00Z"));
      await writeSession(shared, sessionsDir, new Date("2024-01-02T00:00:00Z"), "Second");
      await writeSession(join(directory, "other"), sessionsDir, new Date("2024-01-01T00:00:00Z"));
      // 空 cwd（旧会话）与 cwd 已不存在的会话都要被跳过
      for (const cwd of ["", join(directory, "ghost")]) {
        const manager = SessionManager.create(shared, sessionsDir);
        manager.appendSessionInfo("skipped");
        const header = manager.getHeader() as { timestamp: string; cwd: string };
        header.timestamp = "2024-01-04T00:00:00.000Z";
        header.cwd = cwd;
        await writeFile(
          manager.getSessionFile()!,
          `${[header, ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
          { flag: "wx" },
        );
      }

      expect(await adapter.discoverCandidateWorkspaces()).toEqual([
        {
          canonicalPath: await realpath(shared),
          name: "shared",
          lastModified: "2024-01-03T00:00:00.000Z",
        },
        {
          canonicalPath: await realpath(join(directory, "other")),
          name: "other",
          lastModified: "2024-01-01T00:00:00.000Z",
        },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("进程级缓存首次结果且返回副本，新实例重新扫描", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-candidates-cache-"));
    try {
      const sessionsDir = join(directory, "sessions");
      const adapter = new PiRuntimeAdapterImpl(undefined, undefined, sessionsDir);
      // 首次扫描为空也缓存
      expect(await adapter.discoverCandidateWorkspaces()).toEqual([]);
      await writeSession(directory, sessionsDir, new Date("2024-01-01T00:00:00Z"));
      expect(await adapter.discoverCandidateWorkspaces()).toHaveLength(0);
      // 缓存：新增会话后仍返回首次结果
      await writeSession(join(directory, "second"), sessionsDir, new Date("2024-01-02T00:00:00Z"));
      const cached = await adapter.discoverCandidateWorkspaces();
      expect(cached).toHaveLength(0);
      // 返回的是副本，调用方改动不影响后续调用
      cached.pop();
      expect(await adapter.discoverCandidateWorkspaces()).toHaveLength(0);
      // 新实例重新扫描
      expect(
        await new PiRuntimeAdapterImpl(
          undefined,
          undefined,
          sessionsDir,
        ).discoverCandidateWorkspaces(),
      ).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sessionDir 为函数时返回空（按 workspace 分库，无法全局列举）", async () => {
    const adapter = new PiRuntimeAdapterImpl(undefined, undefined, () => "unused");
    expect(await adapter.discoverCandidateWorkspaces()).toEqual([]);
  });
});

let gateway: Gateway | undefined;
afterEach(async () => {
  await gateway?.stop();
});

const platformPort: PlatformPort = {
  async selectWorkspaceDirectory() {
    return undefined;
  },
  async canonicalizeWorkspacePath(path) {
    return path.replace(/\\/g, "/").replace(/\/$/, "");
  },
};

async function request(
  port: number,
  path: string,
  body?: unknown,
  credential?: string,
  method = body === undefined ? "GET" : "POST",
) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function bootstrap(port: number) {
  const response = await request(port, "/api/v1/bootstrap", { secret: "test-secret" });
  expect(response.status).toBe(201);
  return (await response.json()) as { credential: string };
}

describe("GET /api/v1/workspaces/candidates", () => {
  it("要求认证", async () => {
    gateway = new Gateway({
      runtimeAdapter: new FakePiRuntimeAdapter(),
      bootstrapSecret: "test-secret",
    });
    const port = await gateway.start();
    expect((await request(port, "/api/v1/workspaces/candidates")).status).toBe(401);
  });

  it("返回候选并过滤当前身份已授权目录，revoke 后可重新出现", async () => {
    const runtime = new FakePiRuntimeAdapter();
    runtime.candidates = [
      { canonicalPath: "C:/Alpha", name: "Alpha", lastModified: "2024-01-02T00:00:00.000Z" },
      { canonicalPath: "C:/Beta", name: "Beta", lastModified: "2024-01-01T00:00:00.000Z" },
    ];
    gateway = new Gateway({
      runtimeAdapter: runtime,
      platformPort,
      bootstrapSecret: "test-secret",
    });
    const port = await gateway.start();
    const { credential } = await bootstrap(port);

    const confirm = await request(
      port,
      "/api/v1/workspaces/confirm",
      { path: "C:/Alpha/", name: "Alpha", commandId: "command-1" },
      credential,
    );
    expect(confirm.status).toBe(201);
    const workspace = (await confirm.json()) as { workspace: { id: string } };

    expect(
      await (await request(port, "/api/v1/workspaces/candidates", undefined, credential)).json(),
    ).toEqual({
      candidates: [
        { canonicalPath: "C:/Beta", name: "Beta", lastModified: "2024-01-01T00:00:00.000Z" },
      ],
    });

    await request(
      port,
      `/api/v1/workspaces/${workspace.workspace.id}`,
      { confirm: true },
      credential,
      "DELETE",
    );
    expect(
      await (await request(port, "/api/v1/workspaces/candidates", undefined, credential)).json(),
    ).toEqual({
      candidates: [
        { canonicalPath: "C:/Alpha", name: "Alpha", lastModified: "2024-01-02T00:00:00.000Z" },
        { canonicalPath: "C:/Beta", name: "Beta", lastModified: "2024-01-01T00:00:00.000Z" },
      ],
    });
  });
});
