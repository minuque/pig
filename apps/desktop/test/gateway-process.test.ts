import { EventEmitter } from "node:events"
import { describe, expect, it, vi } from "vitest"

import type { ParentMessage } from "../src/main/gateway-messages.js"
import { connectGateway } from "../src/main/gateway-process.js"

function fakeChild() {
  const sent: ParentMessage[] = []
  const child = Object.assign(new EventEmitter(), {
    postMessage: (message: ParentMessage) => sent.push(message),
    kill: vi.fn(() => true),
  })
  return { child, sent }
}

const noop = { pickDirectory: async () => undefined, onUnexpectedExit: () => {} }

describe("connectGateway", () => {
  it("收到 ready 后拿到端口和 token", async () => {
    const { child } = fakeChild()
    const connected = connectGateway(child, noop)

    child.emit("message", { type: "ready", port: 4321, launchToken: "token" })

    await expect(connected).resolves.toMatchObject({ port: 4321, launchToken: "token" })
  })

  it("启动失败报出子进程的错误并结束子进程", async () => {
    const { child } = fakeChild()
    const connected = connectGateway(child, noop)

    child.emit("message", { type: "failed", message: "端口被占用" })

    await expect(connected).rejects.toThrow("端口被占用")
    expect(child.kill).toHaveBeenCalled()
  })

  it("ready 前退出报启动失败", async () => {
    const { child } = fakeChild()
    const connected = connectGateway(child, noop)

    child.emit("exit", 1)

    await expect(connected).rejects.toThrow("启动前退出")
  })

  it("运行中意外退出触发提示，主动停止不触发", async () => {
    const onUnexpectedExit = vi.fn()
    const crashed = fakeChild()
    const running = connectGateway(crashed.child, { ...noop, onUnexpectedExit })
    crashed.child.emit("message", { type: "ready", port: 1, launchToken: "t" })
    await running
    crashed.child.emit("exit", 3)

    expect(onUnexpectedExit).toHaveBeenCalledWith(3)

    const stopped = fakeChild()
    const connected = connectGateway(stopped.child, { ...noop, onUnexpectedExit })
    stopped.child.emit("message", { type: "ready", port: 1, launchToken: "t" })
    const done = (await connected).stop()

    expect(stopped.sent).toEqual([{ type: "stop" }])
    stopped.child.emit("exit", 0)
    await done
    expect(onUnexpectedExit).toHaveBeenCalledTimes(1)
  })
})
