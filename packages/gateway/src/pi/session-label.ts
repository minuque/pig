import type { SessionEntry } from "@earendil-works/pi-coding-agent"

/** 当前分支第一条用户句正文，供未命名会话当列表名。 */
export function firstUserMessageText(entries: readonly SessionEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.type !== "message" || entry.message.role !== "user") continue
    const text = userContentText(entry.message.content)

    if (text) return text
  }
}

function userContentText(content: unknown): string | undefined {
  if (typeof content === "string") {
    const text = content.replace(/\s+/g, " ").trim()

    return text || undefined
  }

  if (!Array.isArray(content)) return undefined
  const parts: string[] = []

  for (const block of content) {
    if (!block || typeof block !== "object" || !("type" in block) || block.type !== "text") continue

    if (!("text" in block) || typeof block.text !== "string") continue
    parts.push(block.text)
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim()

  return text || undefined
}

/** 列表展示名：用户命名优先，否则用首条消息截断。 */
export function sessionListName(info: {
  name?: string | undefined
  firstMessage?: string | undefined
}): string | undefined {
  const named = info.name?.trim()

  if (named) return named
  const first = info.firstMessage?.replace(/\s+/g, " ").trim()

  if (!first) return undefined

  return first.length > 48 ? `${first.slice(0, 48)}…` : first
}
