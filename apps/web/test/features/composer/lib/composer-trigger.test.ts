import { describe, expect, it } from "vitest"
import {
  applyTriggerChoice,
  composerTriggerAt,
  mentionPathNeedsQuoting,
} from "@features/composer/lib/composer-trigger.js"

describe("composerTriggerAt", () => {
  it("光标处的 @ token 进入文件候选", () => {
    expect(composerTriggerAt("看下 @sr", 7)).toEqual({ kind: "mention", start: 3, query: "sr" })
  })

  it("@ 引号路径未闭合时仍是触发态", () => {
    expect(composerTriggerAt('@"src/ap', 8)).toEqual({ kind: "mention", start: 0, query: "src/ap" })
  })

  it("@ 引号闭合后不再触发", () => {
    expect(composerTriggerAt('@"a b" ', 7)).toBeNull()
  })

  it("行首 / 触发命令菜单，token 内部才算", () => {
    expect(composerTriggerAt("/cle", 4)).toEqual({ kind: "command", start: 0, query: "cle" })
    expect(composerTriggerAt("a/b", 3)).toBeNull()
    expect(composerTriggerAt("看下 /x", 5)).toBeNull()
  })

  it("@token 前的空格不进入查询", () => {
    expect(composerTriggerAt("abc @de f", 6)).toEqual({ kind: "mention", start: 4, query: "d" })
  })
})

describe("mentionPathNeedsQuoting", () => {
  it("空白与 shell 元字符要引号", () => {
    expect(mentionPathNeedsQuoting("a b.ts")).toBe(true)
    expect(mentionPathNeedsQuoting("src/a.ts")).toBe(false)
  })
})

describe("applyTriggerChoice", () => {
  it("文件替换 @token 并补空格", () => {
    const next = applyTriggerChoice(
      "看下 @sr 再",
      6,
      { kind: "mention", start: 3, query: "sr" },
      "src/a.ts",
    )

    expect(next.text).toBe("看下 @src/a.ts  再")
    expect(next.caret).toBe(3 + "@src/a.ts ".length)
  })

  it("含空格路径走引号形式", () => {
    const next = applyTriggerChoice(
      "@a b",
      4,
      { kind: "mention", start: 0, query: "a b" },
      "a b/c.ts",
    )

    expect(next.text).toBe('@"a b/c.ts" ')
  })

  it("命令 token 用 / 前缀", () => {
    const next = applyTriggerChoice(
      "/sk",
      3,
      { kind: "command", start: 0, query: "sk" },
      "skill:lint",
    )

    expect(next.text).toBe("/skill:lint ")
  })
})
