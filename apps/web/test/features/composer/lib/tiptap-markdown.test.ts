import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state"
import { createComposerExtensions } from "@features/composer/lib/tiptap-chips.js"
import {
  collectChips,
  hasPromptContent,
  parsePromptToDoc,
  serializeDocToPrompt,
} from "@features/composer/lib/tiptap-doc.js"
import {
  convertFenceOnEnter,
  handleStructuredEnter,
  splitLineOnShiftEnter,
} from "@features/composer/lib/tiptap-enter.js"
import { isInCodeContext } from "@features/composer/lib/tiptap-markdown.js"
import { positionAtOffset, textOffsetAt } from "@features/composer/lib/tiptap-offset.js"

const schema = getSchema(createComposerExtensions())
const roundTrip = (raw: string, commandNames?: ReadonlySet<string>) =>
  serializeDocToPrompt(parsePromptToDoc(raw, commandNames ? { commandNames } : {}))
const docOf = (raw: string): ProseMirrorNode => schema.nodeFromJSON(parsePromptToDoc(raw))

function textPosition(doc: ProseMirrorNode, needle: string, offset = 0): number {
  let found: number | undefined

  doc.descendants((node, position) => {
    if (found !== undefined) return false

    if (!node.isText) return true
    const index = (node.text ?? "").indexOf(needle)

    if (index === -1) return true
    found = position + index + offset
    return false
  })

  if (found === undefined) throw new Error(`文档里没有 ${needle}`)
  return found
}

function stateAt(doc: ProseMirrorNode, position: number): EditorState {
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.near(doc.resolve(position), 1),
  })
}

function apply(
  state: EditorState,
  run: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean,
) {
  let next = state
  const handled = run(state, (transaction) => {
    next = state.apply(transaction)
  })
  return { handled, state: next }
}

describe("Markdown 块解析与还原", () => {
  it("标题保留级别", () => {
    expect(roundTrip("# 一级")).toBe("# 一级")
    expect(roundTrip("### 三级")).toBe("### 三级")
    expect(roundTrip("###### 六级")).toBe("###### 六级")

    const doc = parsePromptToDoc("## 二级")

    expect(doc.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "二级" }],
    })
  })

  it("引用块按行还原", () => {
    expect(roundTrip("> 引用")).toBe("> 引用")
    expect(roundTrip("> 一\n> 二")).toBe("> 一\n> 二")
  })

  it("围栏代码块保留语言与缩进", () => {
    const raw = "```ts\nconst a = 1\n  缩进\n```"

    expect(roundTrip(raw)).toBe(raw)
    expect(readBlock(raw)).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1\n  缩进" }],
    })
  })

  it("没写语言的代码块也能往返", () => {
    expect(roundTrip("```\n纯文本\n```")).toBe("```\n纯文本\n```")
  })

  it("分隔线单独成块", () => {
    expect(roundTrip("---")).toBe("---")
    expect(parsePromptToDoc("---").content?.[0]).toEqual({ type: "horizontalRule" })
  })

  it("无序、有序、任务列表各自成形", () => {
    expect(roundTrip("- 甲\n- 乙")).toBe("- 甲\n- 乙")
    expect(roundTrip("1. 甲\n2. 乙")).toBe("1. 甲\n2. 乙")
    expect(roundTrip("3. 甲\n4. 乙")).toBe("3. 甲\n4. 乙")
    expect(roundTrip("- [ ] 待办\n- [x] 完成")).toBe("- [ ] 待办\n- [x] 完成")
    expect(parsePromptToDoc("- [x] 完成").content?.[0]).toEqual({
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "完成" }] }],
        },
      ],
    })
  })

  it("嵌套列表按缩进还原", () => {
    const raw = "- 甲\n  - 乙\n  - 丙\n- 丁"

    expect(roundTrip(raw)).toBe(raw)
  })

  it("混合块之间保持空行与顺序", () => {
    const raw = "# 标题\n\n- 甲\n\n> 引用\n\n```ts\nx\n```\n---"

    expect(roundTrip(raw)).toBe(raw)
  })
})

function readBlock(raw: string) {
  return parsePromptToDoc(raw).content?.[0]
}

describe("行内 Markdown", () => {
  it("粗体、斜体、删除线、行内代码往返", () => {
    expect(roundTrip("**粗** 和 *斜* 和 ~~删~~ 和 `码`")).toBe("**粗** 和 *斜* 和 ~~删~~ 和 `码`")
  })

  it("粗体套代码保持 **`x`** 的形状", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "code" }] }],
        },
      ],
    }

    expect(serializeDocToPrompt(doc)).toBe("**`x`**")
  })

  it("粗斜体叠在一起写成三星号", () => {
    expect(
      serializeDocToPrompt({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "兼", marks: [{ type: "bold" }, { type: "italic" }] }],
          },
        ],
      }),
    ).toBe("***兼***")
    expect(parsePromptToDoc("***兼***").content?.[0]?.content?.[0]?.marks).toEqual([
      { type: "bold" },
      { type: "italic" },
    ])
  })

  it("路径与标识符里的下划线原样保留", () => {
    const raw = "看下 src/features/foo_bar.ts 和 __init__.py 和 snake_case_name"

    expect(raw).toContain("foo_bar.ts")
    expect(roundTrip(raw)).toBe(raw)
    expect(parsePromptToDoc(raw).content?.[0]?.content?.some((node) => node.marks)).toBeFalsy()
    expect(roundTrip("_斜线_ 也原样保留")).toBe("_斜线_ 也原样保留")
  })

  it("通配路径里的星号不被当成标记", () => {
    const raw = "改一下 src/**/*.ts"

    expect(roundTrip(raw)).toBe(raw)
    expect(parsePromptToDoc(raw).content?.[0]?.content?.some((node) => node.marks)).toBeFalsy()
  })

  it("转义字符保留原文，不成对的分隔符退化成文本", () => {
    expect(roundTrip("\\*不是斜体\\*")).toBe("\\*不是斜体\\*")
    expect(roundTrip("只有 ** 一半")).toBe("只有 ** 一半")
  })

  it("行内代码里含反引号时加长围栏", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a`b", marks: [{ type: "code" }] }],
        },
      ],
    }
    const text = serializeDocToPrompt(doc)

    expect(text).toBe("``a`b``")
    expect(serializeDocToPrompt(parsePromptToDoc(text))).toBe(text)
  })

  it("行内代码里的 @作用域包 与路径不拆成文件 chip", () => {
    const raw = "安装 `@pig/protocol` 并对比 ` @src/a.ts ` 的写法"
    const doc = parsePromptToDoc(raw)

    expect(collectChips(doc)).toEqual([])
    expect(doc.content?.[0]?.content).toEqual([
      { type: "text", text: "安装 " },
      { type: "text", text: "@pig/protocol", marks: [{ type: "code" }] },
      { type: "text", text: " 并对比 " },
      { type: "text", text: "@src/a.ts", marks: [{ type: "code" }] },
      { type: "text", text: " 的写法" },
    ])
  })

  it("嵌套双反引号的单个行内代码完整匹配闭合围栏", () => {
    const doc = parsePromptToDoc("看 `a``b` 这里")

    expect(doc.content?.[0]?.content).toEqual([
      { type: "text", text: "看 " },
      { type: "text", text: "a``b", marks: [{ type: "code" }] },
      { type: "text", text: " 这里" },
    ])
  })

  it("交叉的删除线与粗体不误弹内层标记且往返不丢字符", () => {
    const raw = "~~hello **world~~**"
    const round = roundTrip(raw)

    expect(round).toBe("~~hello **world~~**")
    expect(
      parsePromptToDoc(raw).content?.[0]?.content?.some((node) =>
        node.marks?.some((m) => m.type === "strike"),
      ),
    ).toBe(false)
  })

  it("末尾带斜杠的目录前缀保持纯文本不转文件 chip", () => {
    const raw = "在 @src/ 下面找"

    expect(collectChips(parsePromptToDoc(raw))).toEqual([])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("空代码块与内部含三反引号行的代码块按动态围栏完整往返", () => {
    expect(roundTrip("```ts\n```")).toBe("```ts\n```")

    const withFence = "````md\n```ts\nconst x = 1\n```\n````"

    expect(readBlock(withFence)).toEqual({
      type: "codeBlock",
      attrs: { language: "md" },
      content: [{ type: "text", text: "```ts\nconst x = 1\n```" }],
    })
    expect(roundTrip(withFence)).toBe(withFence)
  })
})

describe("chip 与嵌套内容", () => {
  it("列表项里的 @路径 仍是文件 chip", () => {
    const raw = "- 看下 @src/a.ts\n- 和 @src/b.ts"

    expect(collectChips(parsePromptToDoc(raw))).toEqual([
      { kind: "file", path: "src/a.ts", label: "a.ts" },
      { kind: "file", path: "src/b.ts", label: "b.ts" },
    ])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("列表项行首的 /命令 仍是命令 chip", () => {
    const raw = "- /clear 清空"

    expect(collectChips(parsePromptToDoc(raw))).toEqual([
      { kind: "command", name: "clear", commandKind: undefined },
    ])
    expect(roundTrip(raw)).toBe(raw)
  })

  it("标题与引用里的 chip 也能收上来", () => {
    const raw = "# 看 @src/a.ts\n> 和 @src/b.ts"

    expect(collectChips(parsePromptToDoc(raw))).toHaveLength(2)
    expect(roundTrip(raw)).toBe(raw)
  })

  it("只有空块也算有内容", () => {
    expect(hasPromptContent("")).toBe(false)
    expect(hasPromptContent("---")).toBe(true)
    expect(hasPromptContent("- ")).toBe(true)
    expect(hasPromptContent("#")).toBe(true)
  })
})

describe("偏移映射", () => {
  const cases = [
    "看下 @src/a.ts",
    "- 甲\n  - 乙\n- 丙",
    "> 引用里的 @src/a.ts",
    "# 标题 @src/a.ts",
    "- [ ] 待办 @src/a.ts",
    "1. 甲\n2. 乙",
    "**粗** 和 `码` 和 @src/a.ts",
    "```ts\nconst a = 1\n```",
  ]

  for (const raw of cases) {
    it(`文本位置与 markdown 偏移一一对应：${raw.replaceAll("\n", "\\n")}`, () => {
      const doc = docOf(raw)
      const serialized = serializeDocToPrompt(doc.toJSON())
      let cursor = 0

      doc.descendants((node, position) => {
        if (!node.isInline) return true

        if (node.isText) {
          const text = node.text ?? ""
          const at = serialized.indexOf(text, cursor)

          expect(at).toBeGreaterThanOrEqual(cursor)

          for (let index = 0; index <= text.length; index += 1) {
            expect(positionAtOffset(doc, textOffsetAt(doc, position + index))).toBe(
              position + index,
            )
          }

          cursor = at + text.length
          return true
        }

        const at = serialized.indexOf("@", cursor)

        expect(at).toBeGreaterThanOrEqual(cursor)
        expect(textOffsetAt(doc, position)).toBe(at)
        expect(positionAtOffset(doc, at)).toBe(position)
        cursor = at + 1
        return true
      })
    })
  }

  it("行首偏移落在第一个块的内容起点", () => {
    const doc = docOf("- 甲")

    expect(positionAtOffset(doc, 0)).toBe(3)
    expect(textOffsetAt(doc, 1)).toBe(0)
    expect(textOffsetAt(doc, 3)).toBe(2)
  })
})

describe("结构化块里的 Enter", () => {
  it("代码块里普通 Enter 只换行，不提交", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1" }],
        },
      ],
    })
    const state = stateAt(doc, textPosition(doc, "const a = 1") + "const a = 1".length)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(1)
    expect(result.state.doc.textContent).toBe("const a = 1\n")
  })

  it("代码块里 Enter 沿用当前行缩进", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "  indented" }] }],
    })
    const state = stateAt(doc, textPosition(doc, "indented") + "indented".length)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.textContent).toBe("  indented\n  ")
  })

  it("光标停在收尾围栏上按 Enter 退出代码块", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const a = 1\n```" }],
        },
      ],
    })
    const state = stateAt(doc, doc.content.size - 1)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).type.name).toBe("codeBlock")
    expect(result.state.doc.child(0).textContent).toBe("const a = 1")
    expect(result.state.doc.child(1).type.name).toBe("paragraph")
  })

  it("代码块末尾空行退出并去掉多余换行", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "x\n\n" }] }],
    })
    const state = stateAt(doc, doc.content.size - 1)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.child(0).textContent).toBe("x")
    expect(result.state.doc.childCount).toBe(2)
  })

  it("段落里的起围栏按 Enter 变成代码块", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "```py" }] }],
    })
    const state = stateAt(doc, textPosition(doc, "```py") + 5)
    const result = apply(state, convertFenceOnEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.child(0).type.name).toBe("codeBlock")
    expect(result.state.doc.child(0).attrs["language"]).toBe("py")
  })

  it("列表项里 Enter 新开一项而不是提交", () => {
    const doc = docOf("- 甲\n- 乙")
    const state = stateAt(doc, textPosition(doc, "甲") + 1)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.child(0).childCount).toBe(3)
    expect(serializeDocToPrompt(result.state.doc.toJSON())).toBe("- 甲\n- \n- 乙")
  })

  it("空列表项按 Enter 退出列表", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "前面" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      ],
    })
    const state = stateAt(doc, doc.content.size - 1)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.child(1).type.name).toBe("paragraph")
  })

  it("引用块里空段落按 Enter 抬出去", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph" }] }, { type: "paragraph" }],
    })
    const state = stateAt(doc, 2)
    const result = apply(state, handleStructuredEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.child(0).type.name).toBe("paragraph")
  })

  it("普通段落交给外层提交，Shift+Enter 断开一段", () => {
    const doc = docOf("aaaa")
    const state = stateAt(doc, textPosition(doc, "aaaa") + 2)

    expect(handleStructuredEnter(state, undefined)).toBe(false)

    const result = apply(state, splitLineOnShiftEnter)

    expect(result.handled).toBe(true)
    expect(result.state.doc.childCount).toBe(2)
    expect(result.state.doc.child(0).textContent).toBe("aa")
    expect(result.state.doc.child(1).textContent).toBe("aa")
  })
})

describe("isInCodeContext", () => {
  it("代码块与行内代码里为真", () => {
    const block = docOf("```ts\nconst a = 1\n```")
    const inline = docOf("看 `码` 收尾")
    const plain = docOf("看 src/a.ts 收尾")

    expect(isInCodeContext(stateAt(block, textPosition(block, "const a = 1") + 2))).toBe(true)
    expect(isInCodeContext(stateAt(inline, textPosition(inline, "码") + 1))).toBe(true)
    expect(isInCodeContext(stateAt(plain, textPosition(plain, "src/a.ts") + 2))).toBe(false)
  })
})
