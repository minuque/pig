import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import { isTurnUnfinished } from "../src/pi/turn-state.js"

const message = (body: Record<string, unknown>) =>
  ({ type: "message", id: "x", parentId: null, timestamp: "", message: body }) as SessionEntry
const assistant = (stopReason: string) => message({ role: "assistant", stopReason, content: [] })
const other = { type: "model_change", id: "m", parentId: null, timestamp: "" } as SessionEntry

describe("外部回合是否没结束：看分支里最后一条用户/助手/工具结果消息", () => {
  it.each([
    ["user", [message({ role: "user", content: "hi" })], true],
    ["toolResult", [message({ role: "toolResult", content: [] })], true],
    ["assistant toolUse", [assistant("toolUse")], true],
    ["assistant stop", [assistant("stop")], false],
    ["assistant length", [assistant("length")], false],
    ["assistant error", [assistant("error")], false],
    ["assistant aborted", [assistant("aborted")], false],
    ["没有这样的条目", [other], false],
    ["空分支", [], false],
    ["末尾的其他条目被跳过", [message({ role: "user", content: "hi" }), other], true],
    ["末尾的其他角色被跳过", [assistant("stop"), message({ role: "bashExecution" })], false],
  ])("%s", (_name, branch, expected) => {
    expect(isTurnUnfinished(branch)).toBe(expected)
  })
})
