import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import type { OptimisticUserMessage } from "@features/session/type.js"
import {
  absorbTranscriptPage,
  NO_TOOL_STARTS,
  projectTranscriptTimeline,
  recordToolStartedAt,
  type TimelineInput,
} from "@features/session/lib/transcript-timeline.js"

function row(id: string, role: "user" | "assistant", text: string): TranscriptItem {
  return { id, role, content: [{ type: "text", text }], timestamp: 0 } as TranscriptItem
}

function user(id: string, text: string, timestamp = 1): UserTranscriptItem {
  return { id, role: "user", content: [{ type: "text", text }], timestamp }
}

function tool(id: string, status: "running" | "complete", timestamp: number): ToolTranscriptItem {
  return {
    id,
    role: "tool",
    toolCallId: id,
    toolName: "read",
    input: { path: "a.ts" },
    content: [{ type: "text", text: "out" }],
    timestamp,
    status,
    isError: false,
  }
}

function project(input: Partial<TimelineInput>): readonly TranscriptItem[] {
  return projectTranscriptTimeline({
    persisted: [],
    liveOverlay: [],
    optimisticSends: [],
    turnPending: false,
    toolStartedAt: NO_TOOL_STARTS,
    ...input,
  })
}

const send = (
  item: UserTranscriptItem,
  knownItemIds: readonly string[],
): OptimisticUserMessage => ({
  item,
  knownItemIds,
})

describe("时间线投影：磁盘底稿与 live 尾部对齐", () => {
  it("磁盘历史里夹着 live 没有的模型切换，已落盘的消息不重复", () => {
    const change = {
      id: "mc",
      role: "system",
      event: {
        kind: "model_change",
        previous: { provider: "a", id: "x" },
        model: { provider: "b", id: "y" },
      },
      timestamp: 0,
    } as const
    const items = project({
      persisted: [
        row("u1", "user", "问"),
        row("a1", "assistant", "答"),
        change,
        row("u2", "user", "再问"),
      ],
      liveOverlay: [
        row("m1", "user", "问"),
        row("m2", "assistant", "答"),
        row("m3", "user", "再问"),
      ],
    })

    expect(items.map((item) => item.id)).toEqual(["u1", "a1", "mc", "u2"])
  })

  it("同 id 覆盖，新 id 追加；临时 id 对齐历史后缀", () => {
    const overlay = project({
      persisted: [row("u1", "user", "a"), row("a1", "assistant", "old")],
      liveOverlay: [row("a1", "assistant", "new"), row("a2", "assistant", "tail")],
    })

    expect(overlay.map((item) => item.id)).toEqual(["u1", "a1", "a2"])
    expect(overlay[1]).toMatchObject({ content: [{ type: "text", text: "new" }] })

    const history = [row("disk-u", "user", "ok"), row("disk-a", "assistant", "嗯。")]

    expect(
      project({
        persisted: history,
        liveOverlay: [row("m1", "user", "ok"), row("m2", "assistant", "嗯。")],
      }).map((item) => item.id),
    ).toEqual(["disk-u", "disk-a"])
    expect(
      project({
        persisted: history.slice(0, 1),
        liveOverlay: [row("m1", "user", "ok"), row("m2", "assistant", "嗯")],
      }).map((item) => item.id),
    ).toEqual(["disk-u", "m2"])
  })

  it("新 Turn 的 live 条目追加在 markdown / Tool Call 历史之后", () => {
    const history = [
      row("u1", "user", "| a | b |\n| --- | --- |"),
      row("a1", "assistant", "$$E = mc^2$$"),
      tool("t1", "complete", 3),
    ]

    expect(
      project({
        persisted: history,
        liveOverlay: [row("u2", "user", "继续"), row("a2", "assistant", "好")],
      }).map((item) => item.id),
    ).toEqual(["u1", "a1", "t1", "u2", "a2"])
  })
})

describe("时间线投影：工具开始时刻", () => {
  it("running 占位记下开始时刻，完成条目按 toolCallId 回填", () => {
    const times = new Map<string, number>()

    recordToolStartedAt(times, tool("t1", "running", 100))
    recordToolStartedAt(times, tool("t1", "complete", 900))
    expect(times.get("t1")).toBe(100)

    const [item] = project({ persisted: [tool("t1", "complete", 900)], toolStartedAt: times })

    expect(item).toMatchObject({ id: "t1", startedAt: 100 })
    expect(project({ persisted: [tool("t2", "complete", 900)], toolStartedAt: times })[0]).toEqual(
      tool("t2", "complete", 900),
    )
  })

  it("非工具条目不受影响", () => {
    const times = new Map([["u1", 1]])
    expect(project({ persisted: [user("u1", "问")], toolStartedAt: times })).toEqual([
      user("u1", "问"),
    ])
  })
})

describe("时间线投影：乐观用户句", () => {
  const optimistic = user("user-1", "新任务", 2)
  const previous = user("u1", "旧任务", 1)
  const assistant = {
    id: "a1",
    role: "assistant",
    content: [{ type: "text", text: "处理中" }],
    status: "streaming",
    timestamp: 3,
  } as AssistantTranscriptItem
  const pending = send(optimistic, [previous.id])

  it("把本地用户句插在提交前历史之后、后续流式内容之前", () => {
    expect(
      project({ persisted: [previous, assistant], optimisticSends: [pending] }).map(
        (item) => item.id,
      ),
    ).toEqual([previous.id, optimistic.id, assistant.id])
  })

  it("服务端同文确认后仍用发送时的 id", () => {
    const confirmed = { ...optimistic, id: "server-u2" }

    expect(
      project({
        persisted: [previous, confirmed, assistant],
        optimisticSends: [pending],
      }).map((item) => item.id),
    ).toEqual([previous.id, optimistic.id, assistant.id])
  })

  it("@ 引用被网关展开后服务端条目仍算同一条确认", () => {
    const expanded = {
      ...optimistic,
      id: "server-u2",
      content: [{ type: "text" as const, text: '新任务\n\n<file name="a.ts">x</file>' }],
    }

    expect(
      project({
        persisted: [previous, expanded, assistant],
        optimisticSends: [pending],
      }).map((item) => item.id),
    ).toEqual([previous.id, optimistic.id, assistant.id])
  })

  it("已知历史之外的同文用户句不算确认", () => {
    const earlierDuplicate = { ...optimistic, id: "earlier-u0", timestamp: 0 }

    expect(
      project({
        persisted: [earlierDuplicate, previous, assistant],
        optimisticSends: [pending],
      }).map((item) => item.id),
    ).toEqual([earlierDuplicate.id, previous.id, optimistic.id, assistant.id])
  })
})

describe("时间线投影：pending assistant", () => {
  it("末尾是用户句才补一条流式助手占位", () => {
    const asked = project({ persisted: [user("u1", "问")], turnPending: true })

    expect(asked.map((item) => item.role)).toEqual(["user", "assistant"])
    expect(asked[1]).toMatchObject({ role: "assistant", status: "streaming", content: [] })
    expect(project({ persisted: [user("u1", "问")], turnPending: false })).toEqual([
      user("u1", "问"),
    ])
    expect(project({ persisted: asked, turnPending: true }).map((item) => item.role)).toEqual([
      "user",
      "assistant",
    ])
  })
})

describe("时间线投影：四层一次算完", () => {
  it("磁盘底稿 + live 对齐 + 工具开始时刻 + 乐观句 + pending 占位", () => {
    const times = new Map<string, number>()
    const running = tool("t1", "running", 10)

    recordToolStartedAt(times, running)
    recordToolStartedAt(times, tool("t1", "complete", 20))

    const persisted = [user("u1", "一", 1), running, row("a1", "assistant", "答一")]
    const liveOverlay = [
      tool("t1", "complete", 20),
      user("m1", "二", 30),
      row("m2", "assistant", "答二"),
    ]
    const local = user("user-9", "二", 30)
    const items = project({
      persisted,
      liveOverlay,
      optimisticSends: [send(local, ["u1", "t1", "a1"])],
      turnPending: true,
      toolStartedAt: times,
    })

    expect(items.map((item) => item.id)).toEqual(["u1", "t1", "a1", local.id, "m2"])
    expect(items[1]).toMatchObject({ startedAt: 10 })
  })

  it("末尾是待确认的用户句时补上占位助手", () => {
    const local = user("user-9", "三", 40)
    const items = project({
      persisted: [user("u1", "二", 30)],
      optimisticSends: [send(local, ["u1"])],
      turnPending: true,
    })

    expect(items.map((item) => item.role)).toEqual(["user", "user", "assistant"])
  })
})

describe("历史页吸收", () => {
  const timing = (userId: string, startedAt: number) => ({
    userId,
    startedAt,
    endedAt: startedAt + 1,
    outcome: "complete" as const,
  })
  const ids = (items: readonly TranscriptItem[]) => items.map((item) => item.id)

  it("已加载窗口只增不缩", () => {
    const opened = absorbTranscriptPage(undefined, {
      items: [row("u2", "user", "最近")],
      timings: [timing("u2", 2)],
      hasMore: true,
    })

    expect(ids(opened.items)).toEqual(["u2"])
    expect(opened.hasMore).toBe(true)
    expect(
      ids(absorbTranscriptPage(opened, { items: [], timings: [], hasMore: false }).items),
    ).toEqual(["u2"])

    const first = absorbTranscriptPage(undefined, {
      items: [row("u1", "user", "一"), row("a1", "assistant", "答")],
      timings: [timing("u1", 1)],
      hasMore: false,
    })
    const second = absorbTranscriptPage(first, {
      items: [row("u2", "user", "二")],
      timings: [timing("u2", 2)],
      hasMore: true,
    })

    expect(ids(second.items)).toEqual(["u1", "a1", "u2"])
    expect(second.timings.map((item) => item.userId)).toEqual(["u1", "u2"])
    expect(second.hasMore).toBe(false)
  })
})
