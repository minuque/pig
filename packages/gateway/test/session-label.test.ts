import { describe, expect, it } from "vitest"
import { sessionListName } from "../src/pi/session-label.js"

describe("sessionListName", () => {
  it("用户命名优先，否则截断首条消息，都空则无展示名", () => {
    expect(sessionListName({ name: "  卸载插件  ", firstMessage: "别的" })).toBe("卸载插件")
    expect(sessionListName({ firstMessage: "帮我看一下这段报错" })).toBe("帮我看一下这段报错")
    expect(sessionListName({ firstMessage: `${"x".repeat(50)}` })?.endsWith("…")).toBe(true)
    expect(sessionListName({})).toBeUndefined()
    expect(sessionListName({ name: "   ", firstMessage: "  " })).toBeUndefined()
  })
})
