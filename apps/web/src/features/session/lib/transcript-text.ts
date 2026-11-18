import type { TranscriptItem } from "@/types/common-type.js"

export function transcriptText(item: TranscriptItem): string {
  if (item.role === "task") return ""
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

/**
 * 网关把 @ 引用展开成「原文\n\n<file name="…">…</file>」后落盘；气泡只展示原文，
 * 剥掉末尾这段追加的文件块。内容里的 </file> 已被网关转义，块边界可靠。
 */
const MENTION_BLOCK_SUFFIX = /\n\n(?:<file name="[^"]*">[\s\S]*?<\/file>\n?)+$/
/** Pi 把 /skill:name 展开成开头的 <skill> 块 + args；剥掉块并还原成 /skill:name args。 */
const SKILL_BLOCK_PREFIX = /^<skill name="([^"]+)"[^>]*>[\s\S]*?<\/skill>(?:\n\n)?/

/** 去掉网关/Pi 追加的展开块（@ 的 <file>、/skill 的 <skill>），还原成用户输入的原文。 */
export function stripExpansionBlocks(text: string): string {
  let next = text.replace(MENTION_BLOCK_SUFFIX, "")
  const skill = SKILL_BLOCK_PREFIX.exec(next)

  if (skill) next = `/skill:${skill[1]} ${next.slice(skill[0].length)}`.trimEnd()
  return next
}

/** 用户句展示文本：真实消息仍是展开文本，气泡只显示原文。 */
export function userMessageText(item: TranscriptItem): string {
  return stripExpansionBlocks(transcriptText(item))
}
