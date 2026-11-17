import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import type { TurnTiming } from "@pig/protocol"

const CUSTOM_TYPE = "pig.turn-timing"

function parseTiming(data: unknown): TurnTiming | undefined {
  if (
    !data ||
    typeof data !== "object" ||
    !("userId" in data) ||
    typeof data.userId !== "string" ||
    !("startedAt" in data) ||
    typeof data.startedAt !== "number" ||
    !Number.isFinite(data.startedAt) ||
    !("outcome" in data)
  )
    return undefined
  const base = { userId: data.userId, startedAt: data.startedAt }

  if (data.outcome === "running") return { ...base, outcome: "running" }

  if (
    (data.outcome === "complete" || data.outcome === "error" || data.outcome === "aborted") &&
    "endedAt" in data &&
    typeof data.endedAt === "number" &&
    Number.isFinite(data.endedAt) &&
    data.endedAt >= data.startedAt
  ) {
    return { ...base, outcome: data.outcome, endedAt: data.endedAt }
  }

  return undefined
}

export function readTurnTimings(entries: readonly SessionEntry[]): TurnTiming[] {
  const users = new Set(
    entries
      .filter((entry) => entry.type === "message" && entry.message.role === "user")
      .map((entry) => entry.id),
  )
  const timings = new Map<string, TurnTiming>()

  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue
    const timing = parseTiming(entry.data)

    if (timing && users.has(timing.userId)) timings.set(timing.userId, timing)
  }

  return [...timings.values()]
}
