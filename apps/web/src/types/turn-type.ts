export type TurnTiming = { userId: string; startedAt: number } & (
  | { outcome: "running"; endedAt?: never }
  | { outcome: "complete" | "error" | "aborted"; endedAt: number }
)
