import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { buildDocJson } from "@features/composer/lib/editor/doc-parse.js"
import { markdownOffsetAt, positionAtMarkdown } from "@features/composer/lib/editor/doc-offset.js"
import {
  serializeEditorDoc,
  serializeSelection,
} from "@features/composer/lib/editor/doc-serialize.js"
import { createComposerExtensions } from "@features/composer/lib/editor/extensions.js"
import { parseInlineMarkdown } from "@features/composer/lib/editor/rich-text.js"

const schema = getSchema(createComposerExtensions())
const docOf = (raw: string): ProseMirrorNode => schema.nodeFromJSON(buildDocJson(raw))
const roundTrip = (raw: string) => serializeEditorDoc(docOf(raw)).value

function chipsOf(raw: string): string[] {
  const chips: string[] = []

  docOf(raw).descendants((node) => {
    if (node.type.name === "fileMention") chips.push(`file:${String(node.attrs["path"])}`)

    if (node.type.name === "commandChip") chips.push(`command:${String(node.attrs["name"])}`)
  })
  return chips
}

function marksOf(raw: string): Array<[string, string[]]> {
  const spans: Array<[string, string[]]> = []

  docOf(raw).descendants((node) => {
    if (node.isText) spans.push([node.text ?? "", node.marks.map((mark) => mark.type.name).sort()])
  })
  return spans
}

describe("Markdown 与文档往返", () => {
  it.each([
    "第一行\n第二行\n\n末行",
    "# 标题\n- 甲\n- 乙",
    "### 三级\n> 引用一\n> 引用二",
    "1. 甲\n2. 乙\n\n3) 丙",
    "- [ ] 待办\n- [x] 完成",
    "- 甲\n  - 乙\n  - 丙\n- 丁",
    "```ts\nconst a = 1\n  缩进\n```\n后面的段落",
    "````md\n```ts\nx\n```\n````",
    "**粗** 和 *斜* 和 ~~删~~ 和 `码`",
    "这是**粗体**，那是*斜体*",
    "3 * 4 * 5，再 * 强调 *",
    "看下 src/features/foo_bar.ts 和 __init__.py 和 snake_case_name",
    "改一下 src/**/*.ts",
    "\\*不是斜体\\*",
    "---\n分隔线之后",
  ])("%j 原样还原", (raw) => {
    expect(roundTrip(raw)).toBe(raw)
  })

  it("空输入只有一个空段落", () => {
    const doc = docOf("")

    expect(doc.childCount).toBe(1)
    expect(doc.child(0).type.name).toBe("paragraph")
    expect(roundTrip("")).toBe("")
  })

  it("块级语法各自成形", () => {
    const doc = docOf("## 二级\n> 引用\n- [x] 完成\n```ts\nx\n```\n---")

    expect(doc.child(0).type.name).toBe("heading")
    expect(doc.child(0).attrs["level"]).toBe(2)
    expect(doc.child(1).type.name).toBe("blockquote")
    expect(doc.child(2).type.name).toBe("taskList")
    expect(doc.child(2).child(0).attrs["checked"]).toBe(true)
    expect(doc.child(3).type.name).toBe("codeBlock")
    expect(doc.child(3).attrs["language"]).toBe("ts")
    expect(doc.child(4).type.name).toBe("horizontalRule")
  })
})

describe("行内强调按左右侧判定", () => {
  it("中文句中的粗体、斜体、删除线无需前置空格", () => {
    expect(parseInlineMarkdown("这是**粗体**呀")).toEqual([
      { text: "这是", marks: [] },
      { text: "粗体", marks: ["bold"] },
      { text: "呀", marks: [] },
    ])
    expect(marksOf("那是*斜体*和~~删除~~")).toEqual([
      ["那是", []],
      ["斜体", ["italic"]],
      ["和", []],
      ["删除", ["strike"]],
    ])
  })

  it("两侧是空白的星号不当强调", () => {
    expect(parseInlineMarkdown("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4", marks: [] }])
    expect(parseInlineMarkdown("** 空心 **")).toEqual([{ text: "** 空心 **", marks: [] }])
  })

  it("粗斜体叠写成三星号，粗体套代码保持形状", () => {
    expect(marksOf("***兼***")).toEqual([["兼", ["bold", "italic"]]])
    expect(roundTrip("***兼***")).toBe("***兼***")
    expect(roundTrip("**`x`**")).toBe("**`x`**")
  })
})

describe("chip 解析", () => {
  it("@路径与带引号路径成为文件 chip，往返不变", () => {
    const raw = '看下 @src/a.ts 和 @"my notes/周报.md"'

    expect(chipsOf(raw)).toEqual(["file:src/a.ts", "file:my notes/周报.md"])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("邮箱、词中 @、目录前缀与行内代码里的 @ 不成 chip", () => {
    expect(chipsOf("发给 user@example.com 或 a@b.ts")).toEqual([])
    expect(chipsOf("在 @src/ 下面找")).toEqual([])
    expect(chipsOf("安装 `@pig/protocol` 包")).toEqual([])
  })

  it("行首或列表标记后的 /命令 成为命令 chip，行中不算", () => {
    expect(chipsOf("/clear 清空")).toEqual(["command:clear"])
    expect(chipsOf("- /skill:review 看下")).toEqual(["command:review"])
    expect(roundTrip("- /skill:review 看下")).toBe("- /skill:review 看下")
    expect(chipsOf("看下 /clear")).toEqual([])
    expect(chipsOf("/usr/bin/env node")).toEqual([])
  })

  it("代码块里的 @ 与 / 保持文字", () => {
    const raw = "```\n/clear @src/a.ts\n```"

    expect(chipsOf(raw)).toEqual([])
    expect(roundTrip(raw)).toBe(raw)
  })
})

describe("Markdown 偏移与文档位置互换", () => {
  it("文字里的每个位置往返一致，chip 只占一格", () => {
    const raw = "- **粗** 看 @src/a.ts 好\n> 引用"
    const doc = docOf(raw)

    doc.descendants((node, pos) => {
      if (!node.isText) return true

      for (let index = 0; index <= node.nodeSize; index += 1) {
        expect(positionAtMarkdown(doc, markdownOffsetAt(doc, pos + index))).toBe(pos + index)
      }

      return false
    })
    const chipEnd = raw.indexOf(" 好")

    expect(markdownOffsetAt(doc, positionAtMarkdown(doc, chipEnd))).toBe(chipEnd)
  })

  it("选区复制补回列表标记与 chip 源码", () => {
    const doc = docOf("- 看 @src/a.ts\n- 乙")

    expect(serializeSelection(doc, 0, doc.content.size)).toBe("- 看 @src/a.ts\n- 乙")
  })
})
