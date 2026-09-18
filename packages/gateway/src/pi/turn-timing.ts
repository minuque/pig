import type { SessionEntry, SessionManager } from "@earendil-works/pi-coding-agent"

const CUSTOM_TYPE = "pig.turn-timing"

type Outcome = "complete" | "error" | "aborted"

export type TurnTiming = { userId: string; startedAt: number } & (
  { outcome: "running"; endedAt?: never } | { outcome: Outcome; endedAt: number }
)

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

export class TurnTimingRecorder {
  private current:
    { startedAt: number; userId?: string; userTimestamp?: number; outcome: Outcome } | undefined

  constructor(private readonly manager: SessionManager) {}

  start() {
    this.current = { startedAt: Date.now(), outcome: "complete" }
  }

  user(timestamp: number) {
    if (!this.current || this.current.userTimestamp !== undefined) return
    this.current.userTimestamp = timestamp
  }

  outcome(outcome: Outcome) {
    if (this.current && this.current.outcome !== "aborted") this.current.outcome = outcome
  }

  persistStart() {
    const current = this.current

    if (!current || current.userId || current.userTimestamp === undefined) return

    const user = this.manager
      .getBranch()
      .reverse()
      .find(
        (entry) =>
          entry.type === "message" &&
          entry.message.role === "user" &&
          entry.message.timestamp === current.userTimestamp,
      )

    if (!user) return

    current.userId = user.id
    this.manager.appendCustomEntry(CUSTOM_TYPE, {
      userId: user.id,
      startedAt: current.startedAt,
      outcome: "running",
    } satisfies TurnTiming)
  }

  finish() {
    this.persistStart()
    const current = this.current
    this.current = undefined

    if (!current?.userId) return

    this.manager.appendCustomEntry(CUSTOM_TYPE, {
      userId: current.userId,
      startedAt: current.startedAt,
      endedAt: Math.max(current.startedAt, Date.now()),
      outcome: current.outcome,
    } satisfies TurnTiming)
  }
}
