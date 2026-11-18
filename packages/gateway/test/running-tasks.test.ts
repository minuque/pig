import { createEventBus, type AgentSession } from "@earendil-works/pi-coding-agent"
import type { Task, TasksEvent } from "@pig/protocol"
import { describe, expect, it } from "vitest"

import { PiHostSession } from "../src/pi/session-runtime.js"

const task = (status: Task["status"]): Task =>
  ({ id: "t", kind: "bash", description: "d", command: "c", status, output: "" }) as Task

describe("网关：排队中的后台任务也算在跑，会话不被当成空闲回收", () => {
  it.each([
    ["queued", true],
    ["running", true],
    ["completed", false],
  ] as const)("%s → %s", (status, running) => {
    const events = createEventBus()
    const session = {
      sessionId: "s",
      sessionManager: {},
      subscribe: () => () => undefined,
    } as unknown as AgentSession
    const host = new PiHostSession(session, undefined, undefined, events)

    events.emit("pig:tasks", { sessionId: "s", tasks: [task(status)] } satisfies TasksEvent)

    expect(host.hasRunningTasks()).toBe(running)
  })
})
