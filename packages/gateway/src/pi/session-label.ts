import type { SessionMetadata } from "@pig/protocol"
import type { SessionEntry } from "@earendil-works/pi-coding-agent"

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

export function recentSessionCwd(sessions: readonly SessionMetadata[]): string | undefined {
  let latest: SessionMetadata | undefined

  for (const session of sessions) {
    if (!session.cwd) continue

    if (!latest || usedAt(session) > usedAt(latest)) latest = session
  }

  return latest?.cwd
}

function usedAt(session: SessionMetadata): number {
  return session.updatedAt ?? session.createdAt
}
