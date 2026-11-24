import { describe, expect, it } from "vitest"
import {
  formatContextReference,
  projectContextForAgent,
  replyReference,
  sessionReference,
} from "@pig/protocol"
import type { TranscriptItem } from "@/types/common-type.js"
import { userMessageParts, userMessageText } from "@features/session/lib/transcript-text.js"

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

  it("userMessageParts 剥离扩展块与信封，同时还原上下文引用片段", () => {
    const session = sessionReference("s1", "旧会话")
    const reply = replyReference("s1", "e9", "第一行\n第二行")
    const raw = `${formatContextReference(session)} 结合 ${formatContextReference(reply)} 看`
    const withFiles = `${raw}\n\n<file name="a.ts">\nexport {}\n</file>`
    const full = projectContextForAgent(withFiles)

    expect(userMessageText(user(full))).toBe("[Session: 旧会话] 结合 [Reply: 第一行 第二行] 看")
    expect(userMessageParts(user(full))).toEqual([
      { kind: "reference", reference: session },
      { kind: "text", text: " 结合 " },
      { kind: "reference", reference: reply },
      { kind: "text", text: " 看" },
    ])
    expect(userMessageParts(user(raw))).toEqual([
      { kind: "reference", reference: session },
      { kind: "text", text: " 结合 " },
      { kind: "reference", reference: reply },
      { kind: "text", text: " 看" },
    ])
  })

  it("userMessageParts 与 userMessageText 保留回复引用中的评论", () => {
    const reply = replyReference("s1", "e9", "原始回答内容", "请重点看这一句")
    const raw = `${formatContextReference(reply)} 补充说明`
    const full = projectContextForAgent(raw)

    expect(userMessageText(user(full))).toBe("[Reply: 请重点看这一句] 补充说明")
    expect(userMessageParts(user(full))).toEqual([
      { kind: "reference", reference: reply },
      { kind: "text", text: " 补充说明" },
    ])
  })
})
