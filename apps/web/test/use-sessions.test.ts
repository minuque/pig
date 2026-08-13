import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, type MaybeRefOrGetter } from "vue";
import type { PiClient } from "@earendil-works/pi-client";
import type { RemoteSessionState } from "@earendil-works/pi-coding-agent/client";

/** 假 RemoteSession：记录 dispose 次数与订阅者，可手动派发状态。 */
const { openMock, createMock, makeSession } = vi.hoisted(() => {
  class FakeRemoteSession {
    id: string | undefined;
    disposeCalls = 0;
    listeners = new Set<(state: RemoteSessionState) => void>();
    state: RemoteSessionState = {
      lifecycle: { status: "ready" },
      transcript: [],
    };
    constructor(id?: string) {
      this.id = id;
    }
    subscribe(listener: (state: RemoteSessionState) => void) {
      this.listeners.add(listener);
      listener(this.state);
      return () => this.listeners.delete(listener);
    }
    dispose() {
      this.disposeCalls += 1;
      return Promise.resolve();
    }
  }
  return {
    openMock: vi.fn<(client: PiClient, sessionId: string) => Promise<FakeRemoteSession>>(),
    createMock: vi.fn<(client: PiClient, options: unknown) => Promise<FakeRemoteSession>>(),
    makeSession: (id?: string) => new FakeRemoteSession(id),
  };
});

vi.mock("@earendil-works/pi-coding-agent/client", () => ({
  RemoteSession: class {
    static open = openMock;
    static create = createMock;
  },
}));

import { useRemoteSessions } from "@features/sessions/hooks/use-sessions.js";

beforeEach(() => {
  openMock.mockReset();
  createMock.mockReset();
});

function setup() {
  // PiClient 含 #private 无法伪造：仅需非空占位，mock 的 RemoteSession.open 不校验参数
  const client = ref<PiClient | undefined>();
  const sessions = useRemoteSessions(client as unknown as MaybeRefOrGetter<PiClient | undefined>);
  client.value = {} as unknown as PiClient;
  return { sessions };
}

describe("useRemoteSessions lifecycle", () => {
  it("openSession 幂等：已附加同 id 时跳过", async () => {
    const { sessions } = setup();
    const a = makeSession("s1");
    openMock.mockResolvedValue(a);
    await sessions.openSession("s1");
    await sessions.openSession("s1");
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(sessions.remote.value).toBe(a);
  });

  it("并发 open 串行执行且替换时释放旧实例 lease", async () => {
    const { sessions } = setup();
    const a = makeSession("s1");
    const b = makeSession("s2");
    openMock.mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    await Promise.all([sessions.openSession("s1"), sessions.openSession("s2")]);
    expect(openMock).toHaveBeenCalledTimes(2);
    expect(a.disposeCalls).toBe(1);
    expect(sessions.remote.value).toBe(b);
  });

  it("createSession 替换已附加实例时释放旧 lease", async () => {
    const { sessions } = setup();
    const a = makeSession("s1");
    const b = makeSession("s2");
    openMock.mockResolvedValue(a);
    await sessions.openSession("s1");
    createMock.mockResolvedValue(b);
    await sessions.createSession("/repo");
    expect(a.disposeCalls).toBe(1);
    expect(sessions.remote.value).toBe(b);
  });

  it("open 失败：不附加、错误上抛", async () => {
    const { sessions } = setup();
    openMock.mockRejectedValue(new Error("boom"));
    await expect(sessions.openSession("s1")).rejects.toThrow("boom");
    expect(sessions.remote.value).toBeUndefined();
  });

  it("dispose 可重复调用且底层只 dispose 一次", async () => {
    const { sessions } = setup();
    const a = makeSession("s1");
    openMock.mockResolvedValue(a);
    await sessions.openSession("s1");
    await Promise.all([sessions.dispose(), sessions.dispose(), sessions.dispose()]);
    expect(a.disposeCalls).toBe(1);
    expect(sessions.remote.value).toBeUndefined();
  });
});
