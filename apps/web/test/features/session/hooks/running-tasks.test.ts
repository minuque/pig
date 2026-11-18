import { describe, expect, it } from "vitest"

import {
  hasRunningTasks,
  type LiveSubscription,
} from "@features/session/hooks/use-live-subscriptions.js"
import type { Task } from "@/types/common-type.js"

const withTask = (status: Task["status"]) =>
  ({
    lastState: { snapshot: { tasks: [{ id: "t", status }] } },
  }) as unknown as LiveSubscription

describe("界面：只剩排队任务时切走也不放掉连接", () => {
  it.each([
    ["queued", true],
    ["running", true],
    ["stopped", false],
  ] as const)("%s → %s", (status, running) => {
    expect(hasRunningTasks(withTask(status))).toBe(running)
  })
})
