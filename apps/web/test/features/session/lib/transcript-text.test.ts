import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"
import { userMessageText } from "@features/session/lib/transcript-text.js"

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem
}

describe("userMessageText", () => {
  const user = (text: string) => item({ role: "user", content: [{ type: "text", text }] })

  it("剥掉网关追加的 @ 引用文件块，只留原文", () => {
    const raw = "@package.json 介绍一下配置文件"
    const expanded = `${raw}\n\n<file name="G:\\AICode\\pig\\package.json">\n{\n  "name": "pig"\n}\n</file>`
    expect(userMessageText(user(expanded))).toBe(raw)
  })

  it("无 @ 引用的原文原样返回", () => {
    expect(userMessageText(user("普通一句话"))).toBe("普通一句话")
  })

  it("/skill 展开块还原成 /skill:name args", () => {
    const expanded =
      '<skill name="vue-best-practices" location="G:\\x\\SKILL.md">\nReferences…\n\nbody\n</skill>\n\n看下这个组件'

    expect(userMessageText(user(expanded))).toBe("/skill:vue-best-practices 看下这个组件")
  })

  it("/skill 无 args 时还原成 /skill:name", () => {
    const expanded = '<skill name="verify" location="x">\nbody\n</skill>'
    expect(userMessageText(user(expanded))).toBe("/skill:verify")
  })
})
