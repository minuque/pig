import { describe, expect, it, vi } from "vitest"
import subagent from "../src/subagent/index.ts"
import { resetSharedRuntime } from "../src/subagent/run.ts"

vi.mock("../src/subagent/run.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/subagent/run.ts")>()),
  resetSharedRuntime: vi.fn(),
}))

type Handler = (...args: never[]) => unknown

function setup() {
  const tools = new Set<string>()
  const handlers = new Map<string, Handler>()
  const listeners = new Map<string, Array<(data: unknown) => void>>()
  const pi = {
    registerTool: (tool: { name: string }) => tools.add(tool.name),
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    events: {
      emit: (channel: string, data: unknown) =>
        [...(listeners.get(channel) ?? [])].forEach((listener) => listener(data)),
      on: (channel: string, listener: (data: unknown) => void) => {
        listeners.set(channel, [...(listeners.get(channel) ?? []), listener])
        return () =>
          listeners.set(
            channel,
            (listeners.get(channel) ?? []).filter((item) => item !== listener),
          )
      },
    },
  }

  subagent(pi as never)
  const session = (event: "session_start" | "session_shutdown") => handlers.get(event)?.()
  return { tools, pi, session }
}

describe("subagent：宿主改过供应商配置后子会话重建模型运行时", () => {
  it("新会话与 pig:models:changed 都丢掉缓存的运行时，会话结束时摘掉监听", () => {
    const { tools, pi, session } = setup()

    expect(tools.has("subagent")).toBe(true)
    session("session_start")
    expect(resetSharedRuntime).toHaveBeenCalledTimes(1)

    pi.events.emit("pig:models:changed", undefined)
    expect(resetSharedRuntime).toHaveBeenCalledTimes(2)

    session("session_shutdown")
    pi.events.emit("pig:models:changed", undefined)
    expect(resetSharedRuntime).toHaveBeenCalledTimes(2)
  })
})
