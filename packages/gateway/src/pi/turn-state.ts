import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { ASK_TOOL } from "@pig/protocol"

export function isTurnUnfinished(branch: readonly SessionEntry[]): boolean {
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index]

    if (entry?.type !== "message") continue
    const message = entry.message

    if (message.role === "toolResult") return message.toolName !== ASK_TOOL

    if (message.role === "user") return true

    if (message.role === "assistant") return message.stopReason === "toolUse"
  }

  return false
}
