import { SessionManager, type SessionEntry } from "@earendil-works/pi-coding-agent"
import type { SessionCard, TranscriptItem } from "@pig/protocol"
import type { IndexedSession } from "./session-index.js"
import { TranscriptProjection } from "./transcript.js"

function transcriptText(item: TranscriptItem): string {
  if (item.role === "task") return ""
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

/** 空失败助手句与侧栏同一口径：无正文且 error/aborted。 */
function isRetryErrorItem(item: TranscriptItem): boolean {
  if (item.role !== "assistant") return false

  if (item.status !== "error" && item.status !== "aborted") return false
  return transcriptText(item).length === 0
}

function conversationItemCount(items: readonly TranscriptItem[]): number {
  let count = 0

  for (const item of items) {
    if (item.role !== "user" && item.role !== "assistant" && item.role !== "tool") continue

    if (isRetryErrorItem(item)) continue
    count += 1
  }

  return count
}

/** 先投影为 TranscriptItem 再计，避免另写空失败语义。 */
export function conversationMessageCount(entries: readonly SessionEntry[]): number {
  return conversationItemCount(new TranscriptProjection().transcript(entries))
}

/** 侧栏卡片用的当前模型：当前分支上最后一次 model_change。 */
export function modelFromBranch(
  entries: readonly SessionEntry[],
): { provider: string; id: string } | undefined {
  let model: { provider: string; id: string } | undefined

  for (const entry of entries) {
    if (entry.type !== "model_change") continue
    model = { provider: entry.provider, id: entry.modelId }
  }

  return model
}

/** 侧栏只区分正常结束与失败；aborted 视为正常停止。 */
export function outcomeFromBranch(
  entries: readonly SessionEntry[],
): "complete" | "error" | undefined {
  const items = new TranscriptProjection().transcript(entries)

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]

    if (item?.role !== "assistant") continue
    return item.status === "error" ? "error" : "complete"
  }

  return undefined
}

function cardOf(info: IndexedSession): SessionCard {
  try {
    const branch = SessionManager.open(info.path).getBranch()
    const model = modelFromBranch(branch)
    const outcome = outcomeFromBranch(branch)
    return {
      id: info.id,
      messageCount: conversationMessageCount(branch),
      ...(model ? { model } : {}),
      ...(outcome ? { outcome } : {}),
    }
  } catch {
    return { id: info.id, messageCount: 0 }
  }
}

/** 会话文件路径 → 按文件版本缓存的卡片；文件没变就不重读分支。 */
export class SessionCardCache {
  private readonly cache = new Map<string, { version: string; card: SessionCard }>()

  list(infos: readonly IndexedSession[]): SessionCard[] {
    const live = new Set(infos.map((info) => info.path))

    for (const path of this.cache.keys()) if (!live.has(path)) this.cache.delete(path)
    return infos.map((info) => {
      const cached = this.cache.get(info.path)

      if (cached?.version === info.version) return cached.card
      const card = cardOf(info)
      this.cache.set(info.path, { version: info.version, card })
      return card
    })
  }
}
