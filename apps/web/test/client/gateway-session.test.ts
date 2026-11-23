import { describe, expect, it, vi } from "vitest"
import type {
  AssistantTranscriptItem,
  Command,
  ServerEvent,
  SessionSnapshot,
  TranscriptProgress,
} from "@pig/protocol"
import type { GatewayClient } from "@client/gateway-client.js"
import { GatewaySession } from "@client/gateway-session.js"

type SessionEvent = Extract<ServerEvent, { type: "session_snapshot" | "session_progress" }>

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "s1",
    cwd: "/repo",
    createdAt: 1,
    updatedAt: 1,
    phase: "idle",
    model: { provider: "anthropic", id: "claude-sonnet" },
    thinkingLevel: "off",
    attached: true,
    locked: true,
    revision: 1,
    transcript: [],
    queuedSteer: [],
    queuedSteerCount: 0,
    tasks: [],
    notices: [],
    ...overrides,
  }
}

function createClient() {
  const listeners = new Set<(event: SessionEvent) => void>()
  const commands: Command[] = []
  const resolvers = new Map<string, ((value: SessionSnapshot) => void)[]>()
  const client = {
    connectionState: "connected",
    requestSession: vi.fn((command: Command) => {
      commands.push(command)

      if (command.command === "attach_session") return Promise.resolve(snapshot())
      return new Promise<SessionSnapshot>((resolve) => {
        const list = resolvers.get(command.command) ?? []

        list.push(resolve)
        resolvers.set(command.command, list)
      })
    }),
    onSessionEvent: vi.fn((_sessionId: string, listener: (event: SessionEvent) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    request: vi.fn(() => Promise.resolve({ command: "detach_session", sessionId: "s1" })),
  } as unknown as GatewayClient

  function emitSnapshot(next: SessionSnapshot) {
    for (const listener of listeners) listener({ type: "session_snapshot", snapshot: next })
  }

  function emitProgress(progress: TranscriptProgress) {
    for (const listener of listeners)
      listener({ type: "session_progress", sessionId: "s1", progress })
  }

  function resolveCommand(name: Command["command"], next: SessionSnapshot) {
    const resolve = resolvers.get(name)?.shift()

    if (!resolve) throw new Error(`No pending command: ${name}`)
    resolve(next)
  }

  return { client, commands, emitSnapshot, emitProgress, resolveCommand }
}

describe("GatewaySession", () => {
  it("submit 飞行期间允许 steer 抢占，且先结束 submit 后最终生命周期回到 ready", async () => {
    const { client, commands, emitSnapshot, resolveCommand } = createClient()
    const session = await GatewaySession.open(client, "s1")
    const submitPromise = session.submit("主轮次")

    emitSnapshot(snapshot({ phase: "turn" }))
    const steerPromise = session.steer("半路引导")

    expect(commands).toContainEqual({ command: "steer", sessionId: "s1", message: "半路引导" })
    expect(session.state.lifecycle).toEqual({ status: "busy", operation: "steer" })

    resolveCommand("prompt", snapshot({ phase: "idle" }))
    await submitPromise
    expect(session.state.lifecycle).toEqual({ status: "busy", operation: "steer" })

    resolveCommand("steer", snapshot({ phase: "idle" }))
    await steerPromise
    expect(session.state.lifecycle).toEqual({ status: "ready" })
  })

  it("steer 飞行期间允许 abort 抢占，结束后生命周期回到 ready", async () => {
    const { client, commands, emitSnapshot, resolveCommand } = createClient()
    const session = await GatewaySession.open(client, "s1")
    const submitPromise = session.submit("主轮次")

    emitSnapshot(snapshot({ phase: "turn" }))
    const steerPromise = session.steer("半路引导")
    const abortPromise = session.abort()

    expect(commands).toContainEqual({ command: "abort", sessionId: "s1" })
    expect(session.state.lifecycle).toEqual({ status: "busy", operation: "abort" })

    resolveCommand("steer", snapshot({ phase: "turn" }))
    await steerPromise
    resolveCommand("prompt", snapshot({ phase: "idle" }))
    await submitPromise
    resolveCommand("abort", snapshot({ phase: "idle" }))
    await abortPromise

    expect(session.state.lifecycle).toEqual({ status: "ready" })
  })

  it("流式助手条目收到 replaces 后原地换成真实 id，不留临时 id 且跨快照保留映射", async () => {
    const { client, emitSnapshot, emitProgress } = createClient()
    const session = await GatewaySession.open(client, "s1")
    const streaming: AssistantTranscriptItem = {
      id: "m1",
      role: "assistant",
      content: [{ type: "text", text: "" }],
      model: { provider: "anthropic", id: "claude-sonnet" },
      timestamp: 10,
      status: "streaming",
    }

    emitProgress({ type: "item_started", item: streaming })
    emitProgress({
      type: "assistant_delta",
      messageId: "m1",
      contentIndex: 0,
      kind: "text",
      delta: "你好",
    })
    emitSnapshot(
      snapshot({
        phase: "turn",
        revision: 2,
        transcript: [{ ...streaming, content: [{ type: "text", text: "你好" }] }],
      }),
    )
    emitProgress({
      type: "item_finished",
      replaces: "m1",
      item: {
        ...streaming,
        id: "entry-1",
        content: [{ type: "text", text: "你好" }],
        status: "complete",
        stopReason: "stop",
      },
    })

    expect(session.state.transcript.map((item) => item.id)).toEqual(["entry-1"])
    expect(session.state.replacedIds?.get("m1")).toBe("entry-1")

    emitSnapshot(snapshot({ phase: "idle", revision: 3, transcript: [] }))
    expect(session.state.replacedIds?.get("m1")).toBe("entry-1")
  })
})
