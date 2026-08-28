import { describe, expect, it } from "vitest"
import type { MarkstreamThreadVirtualState } from "markstream-vue"
import type { TranscriptItem, UserTranscriptItem } from "@earendil-works/pi-protocol"
import {
  projectOptimisticTranscript,
  sessionState,
} from "@features/session-workbench/lib/session-state.js"

function mockThreadState(threadKey = "s"): MarkstreamThreadVirtualState {
  return { threadKey, itemHeights: {}, markdownStates: {} }
}

describe("workbench state", () => {
  it("keeps thread state isolated by session", () => {
    const states = new Map()
    const first = sessionState(states, "session-a")
    first.threadState = mockThreadState("session-a")

    expect(sessionState(states, "session-a")).toBe(first)
    expect(sessionState(states, "session-b")).toMatchObject({
      draft: "",
      optimisticUser: null,
      threadState: null,
    })
  })
})

describe("projectOptimisticTranscript", () => {
  const optimistic: UserTranscriptItem = {
    id: "optimistic-1",
    role: "user",
    content: [{ type: "text", text: "新任务" }],
    timestamp: 2,
  }
  const previous: UserTranscriptItem = {
    id: "u1",
    role: "user",
    content: [{ type: "text", text: "旧任务" }],
    timestamp: 1,
  }
  const assistant = {
    id: "a1",
    role: "assistant",
    content: [{ type: "text", text: "处理中" }],
    status: "streaming",
    timestamp: 3,
  } as TranscriptItem

  it("把乐观用户句插在提交前历史之后、后续流式内容之前", () => {
    expect(
      projectOptimisticTranscript([previous, assistant], {
        item: optimistic,
        knownItemIds: [previous.id],
      }).map((item) => item.id),
    ).toEqual([previous.id, optimistic.id, assistant.id])
  })

  it("收到新的同文服务端用户句后移除乐观投影", () => {
    const confirmed = { ...optimistic, id: "server-u2" }
    const items = [previous, confirmed, assistant]
    expect(
      projectOptimisticTranscript(items, {
        item: optimistic,
        knownItemIds: [previous.id],
      }),
    ).toBe(items)
  })

  it("已知历史之外的同文用户句不算确认", () => {
    const earlierDuplicate = { ...optimistic, id: "earlier-u0", timestamp: 0 }
    expect(
      projectOptimisticTranscript([earlierDuplicate, previous, assistant], {
        item: optimistic,
        knownItemIds: [previous.id],
      }).map((item) => item.id),
    ).toEqual([earlierDuplicate.id, previous.id, optimistic.id, assistant.id])
  })
})
