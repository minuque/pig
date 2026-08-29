import type { SessionEntry } from "@earendil-works/pi-coding-agent"

/** 协议 SessionMetadata 不带消息数/模型；侧栏卡片从 Pi 文件投影。 */
export interface SessionCard {
  id: string
  messageCount: number
  model?: { provider: string; id: string }
}

type SessionMessage = Extract<SessionEntry, { type: "message" }>["message"]

/** 空失败助手句是自动重试残留，不进侧栏条数。 */
export function isRetryErrorMessage(message: SessionMessage): boolean {
  if (message.role !== "assistant") return false
  if (message.stopReason !== "error" && message.stopReason !== "aborted") return false
  const content = message.content
  if (!Array.isArray(content)) return true
  return !content.some((block) => "type" in block && block.type === "text" && Boolean(block.text))
}

/** 侧栏条数：消息条目去掉空失败重试行。 */
export function conversationMessageCount(entries: readonly SessionEntry[]): number {
  let count = 0
  for (const entry of entries) {
    if (entry.type !== "message") continue
    if (isRetryErrorMessage(entry.message)) continue
    count += 1
  }
  return count
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
