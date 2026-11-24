import { describe, expect, it } from "vitest"
import { REPLY_COMMENT_MAX, formatContextReference, replyReference } from "@pig/protocol"
import { getSchema } from "@tiptap/core"
import { buildDocJson } from "@features/composer/lib/editor/doc-parse.js"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import { createComposerExtensions } from "@features/composer/lib/editor/extensions.js"
import {
  isDirectoryMentionPath,
  mentionLanguage,
  resolveReplyCommentDismissal,
} from "@features/composer/lib/editor/reply-citation.js"

const schema = getSchema(createComposerExtensions())

describe("resolveReplyCommentDismissal", () => {
  it("按 Esc 取消；未改内容关闭；有改且未超长自动保存；超长保持打开", () => {
    expect(
      resolveReplyCommentDismissal({
        reason: "escape-key",
        draft: "想写一半",
        savedComment: undefined,
      }),
    ).toEqual({ kind: "cancel" })

    expect(
      resolveReplyCommentDismissal({
        reason: "outside-press",
        draft: "  已保存  ",
        savedComment: "已保存",
      }),
    ).toEqual({ kind: "close" })

    expect(
      resolveReplyCommentDismissal({
        reason: "outside-press",
        draft: null,
        savedComment: undefined,
      }),
    ).toEqual({ kind: "close" })

    expect(
      resolveReplyCommentDismissal({
        reason: "outside-press",
        draft: "补充问题",
        savedComment: undefined,
      }),
    ).toEqual({ kind: "commit", comment: "补充问题" })

    expect(
      resolveReplyCommentDismissal({
        reason: "outside-press",
        draft: "a".repeat(REPLY_COMMENT_MAX + 1),
        savedComment: undefined,
      }),
    ).toEqual({ kind: "keep-open" })
  })
})

describe("mention 路径图标识别", () => {
  it("区分目录、带扩展名文件与无扩展名特殊文件", () => {
    expect(isDirectoryMentionPath("src/nested")).toBe(true)
    expect(isDirectoryMentionPath("src/nested/")).toBe(true)
    expect(isDirectoryMentionPath("src/example.ts")).toBe(false)
    expect(isDirectoryMentionPath("docker/Dockerfile")).toBe(false)
    expect(isDirectoryMentionPath(".gitignore")).toBe(false)
    expect(mentionLanguage("src/example.ts")).toBe("ts")
    expect(mentionLanguage("docker/Dockerfile")).toBe("dockerfile")
  })
})

describe("列表标记宽度与带评论回复引用往返", () => {
  it("有序列表项节点带出 data-marker 与封顶到 10 的 data-marker-width", () => {
    const doc = schema.nodeFromJSON(buildDocJson("1. 第一项\n10. 第十项\n12345678901. 超长"))
    const markers: Array<{ marker: string; width: string }> = []

    doc.descendants((node) => {
      if (node.type.name !== "listItem") return true

      const spec = node.type.spec.toDOM?.(node) as [string, Record<string, unknown>, number]

      markers.push({
        marker: String(spec[1]["data-marker"]),
        width: String(spec[1]["data-marker-width"]),
      })
      return false
    })

    expect(markers).toEqual([
      { marker: "1.", width: "2" },
      { marker: "10.", width: "3" },
      { marker: "12345678901.", width: "10" },
    ])
  })

  it("带评论的回复引用经解析和序列化保持评论不变", () => {
    const ref = replyReference("s-1", "e-1", "原始片段", "这里补充说明")
    const raw = `看 ${formatContextReference(ref)} 吧`
    const doc = schema.nodeFromJSON(buildDocJson(raw))

    expect(serializeEditorDoc(doc).value).toBe(raw)
  })
})
