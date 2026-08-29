import { describe, expect, it } from "vitest"
import type { MarkstreamThreadVirtualState } from "markstream-vue"
import type { TranscriptItem, UserTranscriptItem } from "@earendil-works/pi-protocol"
import {
  isSessionOpening,
  mergeLiveTranscript,
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

describe("isSessionOpening", () => {
  it("lease 已齐但历史未到时仍算打开中，避免空画布闪一下", () => {
    expect(isSessionOpening("s2", "s2", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s1", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s2", "s2")).toBe(false)
    expect(isSessionOpening(undefined, undefined, undefined)).toBe(false)
  })
})

describe("mergeLiveTranscript", () => {
  it("磁盘历史为底，live 按 id 覆盖并追加", () => {
    const persisted = [
      { id: "u1", role: "user", content: [{ type: "text", text: "a" }], timestamp: 1 },
      { id: "a1", role: "assistant", content: [{ type: "text", text: "old" }], timestamp: 2 },
    ] as TranscriptItem[]
    const live = [
      { id: "a1", role: "assistant", content: [{ type: "text", text: "new" }], timestamp: 2 },
      { id: "a2", role: "assistant", content: [{ type: "text", text: "tail" }], timestamp: 3 },
    ] as TranscriptItem[]
    expect(mergeLiveTranscript(persisted, live).map((item) => [item.id, userOrText(item)])).toEqual(
      [
        ["u1", "a"],
        ["a1", "new"],
        ["a2", "tail"],
      ],
    )
    expect(mergeLiveTranscript(persisted, []).map((item) => item.id)).toEqual(["u1", "a1"])
  })
})

function userOrText(item: TranscriptItem): string {
  if (item.role !== "user" && item.role !== "assistant") return item.role
  const block = item.content[0]
  return block && "text" in block ? block.text : ""
}

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
