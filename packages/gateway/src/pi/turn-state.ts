import type { SessionEntry } from "@earendil-works/pi-coding-agent"

/** 分支里最后一条 user / assistant / toolResult 消息说明回合没结束：user、toolResult，或 stopReason 为 toolUse 的 assistant。 */
export function isTurnUnfinished(branch: readonly SessionEntry[]): boolean {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index]

    if (entry?.type !== "message") continue
    const message = entry.message

    if (message.role === "user" || message.role === "toolResult") return true

    if (message.role === "assistant") return message.stopReason === "toolUse"
  }

  return false
}
