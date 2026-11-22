import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import {
  collectChips,
  hasPromptContent,
  parsePromptToDoc,
  serializeDocToPrompt,
} from "@features/composer/lib/tiptap-doc.js"
import { createComposerExtensions } from "@features/composer/lib/tiptap-chips.js"

const roundTrip = (raw: string, commandNames?: ReadonlySet<string>) =>
  serializeDocToPrompt(parsePromptToDoc(raw, commandNames ? { commandNames } : {}))
const chipsOf = (raw: string, commandNames?: ReadonlySet<string>) =>
  collectChips(parsePromptToDoc(raw, commandNames ? { commandNames } : {}))

describe("prompt 文档与纯文本往返", () => {
  it("多行段落原样还原", () => {
    const raw = "第一行\n第二行\n\n末行"

    expect(roundTrip(raw)).toBe(raw)
  })

  it("空输入只有一个空段落", () => {
    const doc = parsePromptToDoc("")

    expect(doc.content).toHaveLength(1)
    expect(doc.content?.[0]).toEqual({ type: "paragraph" })
    expect(serializeDocToPrompt(doc)).toBe("")
  })

  it("@路径变成文件 chip，并还原成同一段文本", () => {
    const raw = "看下 @src/features/a.ts 好吗"
    const doc = parsePromptToDoc(raw)

    expect(collectChips(doc)).toEqual([{ kind: "file", path: "src/features/a.ts", label: "a.ts" }])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("带空格的路径用引号包住，往返不变", () => {
    const raw = '打开 @"my notes/周报.md" 谢谢'

    expect(collectChips(parsePromptToDoc(raw))).toEqual([
      { kind: "file", path: "my notes/周报.md", label: "周报.md" },
    ])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("邮箱与词中 @ 不算文件 chip", () => {
    const raw = "发给 user@example.com 或 a@b.ts 即可"

    expect(collectChips(parsePromptToDoc(raw))).toEqual([])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("行首 /命令 变成命令 chip，跟随的文字留在同一段", () => {
    const doc = parsePromptToDoc("/clear 清空草稿")

    expect(collectChips(doc)).toEqual([{ kind: "command", name: "clear", commandKind: undefined }])
    expect(serializeDocToPrompt(doc)).toBe("/clear 清空草稿")
  })

  it("技能形式保留 skill 前缀", () => {
    const raw = "/skill:review 看下改动"

    expect(collectChips(parsePromptToDoc(raw))).toEqual([
      { kind: "command", name: "review", commandKind: "skill" },
    ])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("行中与行尾残缺的斜杠不当命令", () => {
    expect(collectChips(parsePromptToDoc("看下 /clear"))).toEqual([])
    expect(collectChips(parsePromptToDoc("/usr/bin/env node"))).toEqual([])
  })

  it("给定命令集合时只认集合内的名字", () => {
    const names = new Set(["clear"])

    expect(chipsOf("/clear 一", names)).toHaveLength(1)
    expect(chipsOf("/other 一", names)).toEqual([])
    expect(roundTrip("/other 一", names)).toBe("/other 一")
  })
  it("解析结果能进编辑器 schema", () => {
    const schema = getSchema(createComposerExtensions())
    const doc = schema.nodeFromJSON(parsePromptToDoc("看下 @src/a.ts\n/clear 你好"))

    expect(doc.childCount).toBe(2)
    expect(doc.child(0).child(1).type.name).toBe("fileMention")
    expect(doc.child(1).child(0).type.name).toBe("commandChip")
  })
})

describe("hasPromptContent", () => {
  it("只有空白时为空", () => {
    expect(hasPromptContent("  \n ")).toBe(false)
    expect(hasPromptContent("")).toBe(false)
  })

  it("文字或 chip 都算有内容", () => {
    expect(hasPromptContent("你好")).toBe(true)
    expect(hasPromptContent("@src/a.ts")).toBe(true)
    expect(hasPromptContent("/clear")).toBe(true)
  })
})
