import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@pig/protocol"
import {
  askBoard,
  extensionBoard,
  formatAskAnswers,
  nextUnanswered,
} from "@features/extension-ui/lib/board.js"

const askCall = (input: unknown): TranscriptItem =>
  ({
    id: "t1",
    role: "tool",
    toolCallId: "call-1",
    toolName: "ask_user_question",
    input,
    content: [],
    timestamp: 1,
    status: "complete",
    isError: false,
  }) as TranscriptItem
const user: TranscriptItem = {
  id: "u1",
  role: "user",
  content: [{ type: "text", text: "答" }],
  timestamp: 2,
} as TranscriptItem
const questions = [
  {
    header: "库",
    question: "用哪个库？",
    options: [
      { label: "date-fns", description: "小" },
      { label: "dayjs", description: "快" },
    ],
  },
  {
    header: "功能",
    question: "要哪些？",
    options: [{ label: "lint" }, { label: "types" }],
    multiSelect: true,
    allowCustom: false,
  },
]

describe("提问浮板", () => {
  it("最后一个 ask 调用之后没有后续消息才显示；回答过或对话已继续就收起", () => {
    const board = askBoard([askCall({ questions })])

    expect(board?.questions.map((q) => [q.header, q.multiple, q.reply])).toEqual([
      ["库", false, "free"],
      ["功能", true, "none"],
    ])
    expect(askBoard([askCall({ questions }), user])).toBeUndefined()
    expect(
      askBoard([askCall({ questions }), { ...user, role: "assistant" } as TranscriptItem]),
    ).toBeUndefined()
  })

  it("回答拼成一条用户消息：每题一行，自己写的优先，多选用顿号", () => {
    const board = askBoard([askCall({ questions })])!

    expect(
      formatAskAnswers(board.questions, [
        { picked: ["date-fns"], text: "都不要，用原生 Intl" },
        { picked: ["lint", "types"], text: "" },
      ]),
    ).toBe("库：都不要，用原生 Intl\n功能：lint、types")
  })

  it("下一题跳到下一道没答的题，全答完时没有下一题", () => {
    const answers = [
      { picked: ["a"], text: "" },
      { picked: [], text: "" },
      { picked: ["c"], text: "" },
    ]

    expect(nextUnanswered(answers, 3, 0)).toBe(1)
    expect(nextUnanswered(answers, 3, 1)).toBe(1)
    expect(nextUnanswered([answers[0]!, answers[0]!], 2, 0)).toBeUndefined()
  })

  it("扩展 confirm 变成拒绝 / 允许两项，input 只能写", () => {
    const labels = { allow: "允许", deny: "拒绝" }
    const confirm = extensionBoard(
      { id: "x", method: "confirm", title: "删吗", message: "rm -rf" },
      labels,
    )
    const input = extensionBoard(
      { id: "y", method: "input", title: "名字", placeholder: "填" },
      labels,
    )

    expect(confirm.questions[0]).toMatchObject({ message: "rm -rf", reply: "none" })
    expect(confirm.questions[0]!.options.map((o) => o.label)).toEqual(["拒绝", "允许"])
    expect(input.questions[0]).toMatchObject({ options: [], reply: "line", placeholder: "填" })
  })
})
