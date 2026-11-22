import {
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import { PiHostSession } from "../src/pi/session-runtime.js"

function hostWithSession() {
  let emit: (event: AgentSessionEvent) => void = () => undefined
  let ui: ExtensionUIContext | undefined
  const session = {
    sessionId: "s",
    sessionManager: SessionManager.inMemory("/tmp"),
    model: { provider: "acme", id: "m" },
    thinkingLevel: "off",
    state: {},
    getSteeringMessages: () => [],
    subscribe: (listener: (event: AgentSessionEvent) => void) => {
      emit = listener
      return () => undefined
    },
    bindExtensions: async (options: { uiContext: ExtensionUIContext }) => {
      ui = options.uiContext
    },
  } as unknown as AgentSession
  const host = new PiHostSession(session)
  return { host, emit: (event: AgentSessionEvent) => emit(event), ui: () => ui! }
}

describe("网关：重试、压缩和扩展告警进快照", () => {
  it("自动重试期间快照带重试进度，结束后清掉", () => {
    const { host, emit } = hostWithSession()

    emit({
      type: "auto_retry_start",
      attempt: 2,
      maxAttempts: 3,
      delayMs: 3000,
      errorMessage: "overloaded",
    })
    expect(host.snapshot().activity).toMatchObject({
      kind: "retry",
      attempt: 2,
      maxAttempts: 3,
      errorMessage: "overloaded",
    })

    emit({ type: "auto_retry_end", success: true, attempt: 2 })
    expect(host.snapshot().activity).toBeUndefined()
  })

  it("压缩失败留一条通知且只触发一次快照广播，用户中止的压缩不留", () => {
    const { host, emit } = hostWithSession()
    const end = { type: "compaction_end", reason: "threshold", result: undefined, willRetry: false }
    let snapshots = 0

    host.subscribe((event) => {
      if (event.type === "snapshot") snapshots += 1
    })

    emit({ type: "compaction_start", reason: "threshold" })
    expect(host.snapshot().activity).toEqual({ kind: "compaction", reason: "threshold" })

    emit({ ...end, aborted: true, errorMessage: "aborted" } as AgentSessionEvent)
    snapshots = 0
    emit({ ...end, aborted: false, errorMessage: "摘要超时" } as AgentSessionEvent)

    const { activity, notices } = host.snapshot()
    expect(snapshots).toBe(1)
    expect(activity).toBeUndefined()
    expect(notices.map((item) => item.event)).toEqual([
      { kind: "compaction_failed", errorMessage: "摘要超时" },
    ])
  })

  it("扩展的 warning、error 通知进快照，info 仍作为界面请求转发", async () => {
    const { host, ui } = hostWithSession()
    const forwarded: unknown[] = []
    host.subscribe((event) => {
      if (event.type === "extension_ui") forwarded.push(event.request)
    })
    await host.bindExtensions()

    ui().notify("已保存", "info")
    ui().notify("3 个文件未格式化", "warning")
    ui().notify("钩子加载失败", "error")

    expect(forwarded).toMatchObject([{ method: "notify", message: "已保存" }])
    expect(host.snapshot().notices.map((item) => item.event)).toEqual([
      { kind: "extension_notice", level: "warning", message: "3 个文件未格式化" },
      { kind: "extension_notice", level: "error", message: "钩子加载失败" },
    ])
  })
})
