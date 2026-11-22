import { describe, expect, it } from "vitest"
import { createPromptHistory } from "@features/composer/lib/prompt-history.js"

describe("createPromptHistory", () => {
  it("push 跳过空白与连续重复", () => {
    const history = createPromptHistory()

    history.push("一")
    history.push("一")
    history.push("   ")
    history.push("二")

    expect(history.entries()).toEqual(["一", "二"])
    expect(history.size).toBe(2)
  })

  it("prev 从旧到新走，next 走回并还原草稿", () => {
    const history = createPromptHistory()

    history.push("一")
    history.push("二")

    expect(history.prev("草稿")).toBe("二")
    expect(history.prev("二")).toBe("一")
    expect(history.prev("一")).toBe("一")
    expect(history.next()).toBe("二")
    expect(history.next()).toBe("草稿")
    expect(history.next()).toBeUndefined()
  })

  it("没有历史时 prev 返回 undefined，光标复位后重新从最新开始", () => {
    const history = createPromptHistory()

    expect(history.prev("草稿")).toBeUndefined()

    history.push("一")
    expect(history.prev("草稿")).toBe("一")
    history.resetCursor()
    expect(history.next()).toBeUndefined()
    expect(history.prev("草稿2")).toBe("一")
    expect(history.next()).toBe("草稿2")
  })

  it("只留最近 50 条", () => {
    const history = createPromptHistory()

    for (let index = 1; index <= 60; index += 1) history.push(`条目${index}`)

    expect(history.size).toBe(50)
    expect(history.entries()[0]).toBe("条目11")
    expect(history.entries().at(-1)).toBe("条目60")
    expect(history.prev("空")).toBe("条目60")
  })
})
