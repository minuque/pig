import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PiHostSession } from "../src/pi/session-runtime.js"
import { readTurnTimings } from "../src/pi/turn-timing.js"

const directories: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe("一轮工作 → HTTP 历史中的真实耗时", () => {
  it.each(["complete", "aborted", "error"] as const)(
    "%s 分支：记录完整 prompt 耗时，中止或失败也落盘，重新打开保留",
    async (outcome) => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(1000)

      const directory = await mkdtemp(join(tmpdir(), "pig-timing-"))
      directories.push(directory)
      const manager = SessionManager.create(directory, directory)

      let notify: (event: AgentSessionEvent) => void = () => {}

      let finish: () => void = () => {}

      const pending = new Promise<void>((resolve) => {
        finish = resolve
      })

      const user = { role: "user", content: "执行任务", timestamp: 1000 } as const

      const session = {
        sessionManager: manager,
        isIdle: true,
        subscribe(listener: (event: AgentSessionEvent) => void) {
          notify = listener

          return () => {}
        },
        async prompt() {
          notify({ type: "message_end", message: user })
          manager.appendMessage(user)
          await pending
          manager.appendMessage({
            role: "assistant",
            api: "openai-responses",
            provider: "test",
            model: "test",
            content: outcome === "complete" ? [{ type: "text", text: "完成" }] : [],
            timestamp: 2000,
            stopReason: outcome === "complete" ? "stop" : outcome,
            usage: {
              input: 1,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 2,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
          })

          if (outcome === "error") throw new Error("网络断开")
        },
        async abort() {
          finish()
        },
        async waitForIdle() {},
        dispose() {},
      } satisfies Pick<
        AgentSession,
        "sessionManager" | "isIdle" | "subscribe" | "prompt" | "abort" | "waitForIdle" | "dispose"
      >

      const runtime = new PiHostSession(session as unknown as AgentSession)
      const prompt = runtime.prompt({ text: "执行任务" })
      await Promise.resolve()
      const active = runtime.historyTranscript()
      expect(active.timings).toEqual([
        { userId: active.items[0]?.id, startedAt: 1000, outcome: "running" },
      ])

      vi.setSystemTime(66000)

      if (outcome === "aborted") await runtime.abort()
      else finish()

      if (outcome === "error") await expect(prompt).rejects.toThrow("网络断开")
      else await prompt

      const history = runtime.historyTranscript()
      expect(history.timings).toEqual([
        { userId: history.items[0]?.id, startedAt: 1000, endedAt: 66000, outcome },
      ])
      expect(history.items.every((item) => item.role === "user" || item.role === "assistant")).toBe(
        true,
      )

      const file = manager.getSessionFile()
      expect(file).toBeDefined()

      if (!file) throw new Error("Missing persisted session")
      expect(readTurnTimings(SessionManager.open(file).getBranch())).toEqual(history.timings)
      await runtime.dispose()
    },
  )
})
