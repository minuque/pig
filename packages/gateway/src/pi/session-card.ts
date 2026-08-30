import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import { TranscriptProjection } from "./transcript.js"

/** 协议 SessionMetadata 不带消息数/模型；侧栏卡片从 Pi 文件投影。 */
export interface SessionCard {
  id: string
  messageCount: number
  model?: { provider: string; id: string }
}

function transcriptText(item: TranscriptItem): string {
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
