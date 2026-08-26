import { describe, expect, it } from "vitest"
import type { SessionSnapshot, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  projectSessionSnapshot,
  workbenchHeaderTitle,
} from "@features/session-workbench/lib/session-state.js"

function userItem(text: string): TranscriptItem {
  return {
    id: `u-${text}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 1,
  }
}
describe("projectSessionSnapshot", () => {
  function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
    return {
      id: "s1",
      cwd: "/repo",
      createdAt: 1,
      updatedAt: 2,
      phase: "idle",
      model: { provider: "test", id: "model" },
      thinkingLevel: "medium",
      attached: true,
      locked: false,
      revision: 1,
      transcript: [userItem("hi")],
      queuedSteer: [],
      queuedSteerCount: 0,
      ...overrides,
    }
  }
  it("derives display fields and default name", () => {
    const projection = projectSessionSnapshot(snapshot())
    expect(projection.name).toBe("新会话")
    expect(projection.cwd).toBe("/repo")
    expect(projection.running).toBe(false)
  })
  it("marks non-idle phases as running", () => {
    const projection = projectSessionSnapshot(snapshot({ phase: "turn", transcript: [] }))
    expect(projection.running).toBe(true)
  })
})

describe("workbenchHeaderTitle", () => {
  it("rename 后顶栏用列表名，不沿用过期的 snapshot name", () => {
    expect(
      workbenchHeaderTitle({
        sessionId: "s1",
        listed: [{ id: "s1", sessionName: "卸载插件" }],
        projectionName: "旧名字",
      }),
    ).toBe("卸载插件")
  })

  it("无打开会话时不显示标题", () => {
    expect(
      workbenchHeaderTitle({
        sessionId: undefined,
        listed: [],
        projectionName: undefined,
      }),
    ).toBe("")
  })

  it("列表尚未包含该会话时回落 snapshot 名", () => {
    expect(
      workbenchHeaderTitle({
        sessionId: "s1",
        listed: [],
        projectionName: "新会话",
      }),
    ).toBe("新会话")
  })
})
