import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { TranscriptProgress } from "@earendil-works/pi-protocol";
import { SessionBusyError } from "@earendil-works/pi-server";
import { afterEach, describe, expect, it } from "vitest";
import { PiHostService } from "../src/pi/service.js";
import { PiHostSession } from "../src/pi/session-runtime.js";
import { TranscriptProjection } from "../src/pi/transcript.js";

// --- 测试替身 -------------------------------------------------------------

class FakeAgentSession {
  isStreaming = false;
  isCompacting = false;
  retryAttempt = 0;
  sessionId = "session-1";
  sessionName: string | undefined;
  model: { provider: string; id: string } = { provider: "test", id: "test-model" };
  thinkingLevel = "medium";
  steering: string[] = [];
  prompts: string[] = [];
  steers: string[] = [];
  aborted = false;
  disposed = false;
  private readonly listeners = new Set<(event: AgentSessionEvent) => void>();
  constructor(public sessionManager: SessionManager) {}

  get isIdle() {
    return !this.isStreaming;
  }
  get modelRuntime() {
    return {
      getModel: (provider: string, id: string) =>
        provider === this.model.provider && id === this.model.id ? this.model : undefined,
    };
  }
  subscribe(listener: (event: AgentSessionEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async prompt(text: string) {
    this.prompts.push(text);
  }
  async steer(text: string) {
    this.steers.push(text);
  }
  async abort() {
    this.aborted = true;
  }
  async setModel(model: { provider: string; id: string }) {
    this.model = model;
  }
  setThinkingLevel(level: string) {
    this.thinkingLevel = level;
  }
  getSteeringMessages() {
    return this.steering;
  }
  async waitForIdle() {}
  dispose() {
    this.disposed = true;
  }
  emit(event: AgentSessionEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

const asSession = (fake: FakeAgentSession) => fake as unknown as AgentSession;

const baseRuntime = {
  getModel: (provider: string, id: string) =>
    provider === "test" && id === "test-model" ? { provider, id } : undefined,
  getAvailable: async () => [
    {
      provider: "test",
      id: "test-model",
      name: "Test Model",
      api: "test",
      reasoning: false,
      input: ["text"],
      contextWindow: 1000,
      maxTokens: 1000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
  ],
  hasConfiguredAuth: () => true,
};

type TestMessage = Parameters<SessionManager["appendMessage"]>[0];

const assistantMessage = (overrides: Record<string, unknown> = {}): TestMessage =>
  ({
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
    api: "test",
    provider: "test-provider",
    model: "test-model",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "pending",
    timestamp: 1000,
    ...overrides,
  }) as TestMessage;

const toolResultMessage = (overrides: Record<string, unknown> = {}): TestMessage =>
  ({
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "bash",
    content: [{ type: "text", text: "out" }],
    isError: false,
    timestamp: 2000,
    ...overrides,
  }) as TestMessage;

// --- TranscriptProjection --------------------------------------------------

describe("TranscriptProjection", () => {
  it("maps assistant message events to streaming progress with a stable id", () => {
    const projection = new TranscriptProjection();
    const start = projection.progress({
      type: "message_start",
      message: assistantMessage(),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_started" }>;
    expect(start.type).toBe("item_started");
    expect(start.item).toMatchObject({ role: "assistant", status: "streaming" });

    const update = projection.progress({
      type: "message_update",
      message: assistantMessage(),
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "x",
        partial: assistantMessage(),
      },
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_updated" }>;
    expect(update.item.id).toBe(start.item.id);

    const end = projection.progress({
      type: "message_end",
      message: assistantMessage({ stopReason: "stop", content: [{ type: "text", text: "hello" }] }),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_finished" }>;
    expect(end.item).toMatchObject({ id: start.item.id, status: "complete", stopReason: "stop" });
  });

  it("maps tool execution start and tool result end to the same toolCallId", () => {
    const projection = new TranscriptProjection();
    const start = projection.progress({
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "bash",
      args: { cmd: "ls" },
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_started" }>;
    expect(start.item).toMatchObject({ role: "tool", status: "running", toolCallId: "call-1" });

    const end = projection.progress({
      type: "message_end",
      message: toolResultMessage(),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_finished" }>;
    expect(end.item).toMatchObject({
      id: "call-1",
      role: "tool",
      status: "complete",
      isError: false,
    });
    expect(end.item).toHaveProperty("input", { cmd: "ls" });
  });

  it("projects only the current branch after branching", () => {
    const manager = SessionManager.inMemory("/tmp");
    manager.appendMessage({ role: "user", content: "q1", timestamp: 1000 });
    const branchPoint = manager.getLeafId();
    manager.appendMessage(assistantMessage({ timestamp: 2000 }));
    // 分支：放弃当前路径，从 branchPoint 重新开始
    manager.branch(branchPoint!);
    manager.appendMessage(assistantMessage({ stopReason: "stop", timestamp: 3000 }));

    expect(manager.getEntries()).toHaveLength(3); // 含被放弃的分支条目
    const items = new TranscriptProjection().transcript(manager.getBranch());
    expect(items).toHaveLength(2); // 只含当前分支的 user + assistant
    expect(items[1]).toMatchObject({ role: "assistant", status: "complete" });
  });
});

// --- PiHostSession ---------------------------------------------------------

describe("PiHostSession", () => {
  it("builds a snapshot and derives phase from agent state", () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"));
    const runtime = new PiHostSession(asSession(fake));
    const snapshot = runtime.snapshot();
    expect(snapshot).toMatchObject({
      id: "session-1",
      cwd: resolve("/tmp"),
      phase: "idle",
      model: { provider: "test", id: "test-model" },
      thinkingLevel: "medium",
      revision: 0,
      transcript: [],
      queuedSteerCount: 0,
    });
    fake.isStreaming = true;
    expect(runtime.getPhase()).toBe("turn");
    fake.isStreaming = false;
    fake.isCompacting = true;
    expect(runtime.getPhase()).toBe("compaction");
  });

  it("rejects idle steer and conflicting operations but allows steer during a turn", async () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"));
    const runtime = new PiHostSession(asSession(fake));
    await expect(runtime.steer({ text: "x" })).rejects.toBeInstanceOf(SessionBusyError);
    fake.isStreaming = true;
    await expect(runtime.prompt({ text: "x" })).rejects.toBeInstanceOf(SessionBusyError);
    await expect(runtime.setModel({ provider: "test", id: "test-model" })).rejects.toBeInstanceOf(
      SessionBusyError,
    );
    // turn 中 steer 不被 prompt 的互斥锁阻塞（AgentSession.steer 仅入队）
    await expect(runtime.steer({ text: "continue" })).resolves.toBeUndefined();
    expect(fake.steers).toEqual(["continue"]);
    fake.isStreaming = false;
    await runtime.prompt({ text: "hello" });
    expect(fake.prompts).toEqual(["hello"]);
  });

  it("forwards progress without an immediate stale snapshot", async () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"));
    const runtime = new PiHostSession(asSession(fake));
    const events: { type: string }[] = [];
    runtime.subscribe((event) => events.push(event));
    fake.emit({ type: "message_start", message: assistantMessage() } as AgentSessionEvent);
    fake.emit({ type: "turn_start" } as AgentSessionEvent);
    fake.emit({
      type: "message_update",
      message: assistantMessage(),
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "x",
        partial: assistantMessage(),
      },
    } as AgentSessionEvent);
    // message_start/message_update 只发 progress，不发 snapshot（旧快照会清掉流式 progress）
    expect(events.map((e) => e.type)).toEqual(["progress", "snapshot", "progress"]);
    fake.emit({
      type: "message_end",
      message: assistantMessage({ stopReason: "stop", content: [{ type: "text", text: "hello" }] }),
    } as AgentSessionEvent);
    // message_end 的 snapshot 延迟到持久化之后（queueMicrotask）
    expect(events.map((e) => e.type)).toEqual(["progress", "snapshot", "progress", "progress"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events.map((e) => e.type)).toEqual([
      "progress",
      "snapshot",
      "progress",
      "progress",
      "snapshot",
    ]);
    expect(runtime.snapshot().revision).toBe(5);
  });

  it("disposes the underlying session", async () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"));
    const runtime = new PiHostSession(asSession(fake));
    await runtime.dispose();
    expect(fake.disposed).toBe(true);
  });
});

// --- PiHostService ---------------------------------------------------------

describe("PiHostService", () => {
  const temps: string[] = [];
  afterEach(async () => {
    await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
    temps.length = 0;
  });

  const makeService = async (sessionDir?: string) => {
    const dir = sessionDir ?? (await mkdtemp(join(tmpdir(), "pig-pi-host-")));
    if (!sessionDir) temps.push(dir);
    const sessions = new Map<string, FakeAgentSession>();
    const service = new PiHostService({
      sessionDir: dir,
      cwd: dir,
      createRuntime: async () => baseRuntime as never,
      createSession: (async (options: { sessionManager: SessionManager; model?: unknown }) => {
        const fake = new FakeAgentSession(options.sessionManager);
        fake.sessionId = options.sessionManager.getSessionId();
        if (options.model) fake.model = options.model as { provider: string; id: string };
        sessions.set(fake.sessionId, fake);
        return { session: fake as unknown as AgentSession };
      }) as never,
    });
    return { dir, service, sessions };
  };

  it("creates a persisted session and reopens it by id", async () => {
    const { service, sessions } = await makeService();
    const runtime = await service.createSession({ id: "sess-1" });
    expect((await runtime.snapshot()).id).toBe("sess-1");
    expect(sessions.has("sess-1")).toBe(true);

    const metadata = await service.listSessions();
    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toMatchObject({ id: "sess-1", cwd: expect.any(String) });
    expect(await service.listSessionCards()).toMatchObject([{ id: "sess-1", messageCount: 0 }]);

    const fake = sessions.get("sess-1");
    fake!.sessionManager.appendMessage({ role: "user", content: "hi", timestamp: 1000 });
    fake!.sessionManager.appendModelChange("test", "test-model");
    expect(await service.listSessionCards()).toMatchObject([
      { id: "sess-1", messageCount: 1, model: { provider: "test", id: "test-model" } },
    ]);

    const reopened = await service.openSession("sess-1");
    expect(await reopened.snapshot()).toMatchObject({ id: "sess-1" });
  });

  it("reopens a session in a fresh service and restores the transcript", async () => {
    // 进程重开：两个全新 PiHostService 共享 sessionDir，从磁盘恢复会话与 Transcript
    const dir = await mkdtemp(join(tmpdir(), "pig-pi-host-"));
    temps.push(dir);
    const first = await makeService(dir);
    const runtime = await first.service.createSession({ id: "sess-1" });
    const fake = first.sessions.get("sess-1");
    expect(fake).toBeDefined();
    const manager = fake!.sessionManager;
    manager.appendMessage({ role: "user", content: "hi", timestamp: 1000 });
    manager.appendMessage(
      assistantMessage({
        stopReason: "toolUse",
        content: [
          { type: "text", text: "run" },
          { type: "toolCall", id: "call-1", name: "bash", arguments: { cmd: "ls" } },
        ],
        timestamp: 2000,
      }),
    );
    manager.appendMessage(toolResultMessage({ timestamp: 3000 }));
    expect((await runtime.snapshot()).transcript).toHaveLength(3);

    const second = await makeService(dir);
    const reopened = await second.service.openSession("sess-1");
    const snapshot = await reopened.snapshot();
    expect(snapshot).toMatchObject({ id: "sess-1" });
    expect(snapshot.transcript.map((item) => item.role)).toEqual(["user", "assistant", "tool"]);
    expect(snapshot.transcript[2]).toMatchObject({
      toolCallId: "call-1",
      input: { cmd: "ls" },
      status: "complete",
    });
  });

  it("renames via SessionManager and deletes the session file", async () => {
    const { service } = await makeService();
    await service.createSession({ id: "sess-1" });
    await service.renameSession("sess-1", "卸载插件");
    expect(await service.listSessions()).toMatchObject([{ id: "sess-1", sessionName: "卸载插件" }]);
    await service.deleteSession("sess-1");
    expect(await service.listSessions()).toEqual([]);
  });

  it("rejects an unknown session and an unavailable model", async () => {
    const { service } = await makeService();
    await expect(service.openSession("missing")).rejects.toThrow(/not found/);
    await expect(
      service.createSession({ id: "sess-2", model: { provider: "test", id: "nope" } }),
    ).rejects.toThrow(/unavailable/);
    // 回滚：失败创建不遗留会话文件
    expect(await service.listSessions()).toHaveLength(0);
  });

  it("lists protocol model metadata", async () => {
    const { service } = await makeService();
    const models = await service.listModels();
    expect(models).toEqual([
      expect.objectContaining({ provider: "test", id: "test-model", authenticated: true }),
    ]);
  });
});
