import { t } from "@i18n/index.js"
import type { SessionPhase, TranscriptItem } from "@/types/common-type.js"
import type { ThoughtStep, TimelineRow, ToolRow } from "@features/transcript-view/type.js"

export type TurnActivity =
  | { kind: "tools"; label: string }
  | { kind: "compacting"; label: string }
  | { kind: "thinking"; label: string; thinkingDoneSeconds?: number }
  | { kind: "waiting"; label: string }
  | null

const THINKING_DONE_WINDOW_MS = 2000

function thinkingLabel(elapsedSeconds: number): string {
  if (elapsedSeconds >= 60) return t("transcript.statusThinkingAlmost")

  if (elapsedSeconds >= 45) return t("transcript.statusThinkingSomeMore")

  if (elapsedSeconds >= 30) return t("transcript.statusThinkingMore")

  if (elapsedSeconds >= 15) return t("transcript.statusThinkingStill")
  return t("transcript.thinking")
}

function lastTurnRows(rows: readonly TimelineRow[]): readonly TimelineRow[] {
  const lastUserIndex = rows.findLastIndex((row) => row.role === "user")
  return lastUserIndex < 0 ? rows : rows.slice(lastUserIndex)
}

function lastLiveToolRow(rows: readonly TimelineRow[]): ToolRow | undefined {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]

    if (row?.role === "tools") return row
  }

  return undefined
}

function lastThoughtStep(row: { steps: readonly { type: string }[] }): ThoughtStep | undefined {
  const step = row.steps.at(-1)
  return step?.type === "thought" ? (step as ThoughtStep) : undefined
}

function recentFinishedThought(rows: readonly TimelineRow[]): ThoughtStep | undefined {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]

    if (row?.role !== "tools") continue

    for (let j = row.steps.length - 1; j >= 0; j -= 1) {
      const step = row.steps[j]

      if (step?.type === "thought" && step.endedAt !== undefined) return step
    }
  }

  return undefined
}

export function turnActivity(input: {
  rows: readonly TimelineRow[]
  phase: SessionPhase | undefined
  sending: boolean
  stopping: boolean
  elapsedSeconds: number
  now: number
}): TurnActivity {
  if (input.stopping) return null

  switch (input.phase) {
    case "compaction":
      return { kind: "compacting", label: t("transcript.compressing") }
    case "retry":
      return { kind: "tools", label: t("transcript.retrying") }
    case "branch_summary":
      return { kind: "tools", label: t("transcript.branchSummary") }
    default:
      break
  }

  if (input.phase !== "turn" && !input.sending) return null

  const turnRows = lastTurnRows(input.rows)
  const toolRow = lastLiveToolRow(turnRows)

  if (toolRow && toolRow.mode === "live") {
    for (const step of toolRow.steps) {
      if (step.type === "tools" && step.items.some((item) => item.running))
        return { kind: "tools", label: t("transcript.statusRunningTools") }
    }
  }

  const lastRow = turnRows.at(-1)
  const lastStep = toolRow ? lastThoughtStep(toolRow) : undefined
  const thinkingStreaming = lastStep?.streaming === true && lastRow === toolRow
  const assistantPending =
    lastRow?.role === "assistant" && lastRow.streaming && !lastRow.text.trim()

  if (thinkingStreaming || assistantPending)
    return { kind: "thinking", label: thinkingLabel(input.elapsedSeconds) }

  const finished = input.rows.length ? recentFinishedThought(input.rows) : undefined

  if (finished?.endedAt !== undefined && input.now - finished.endedAt < THINKING_DONE_WINDOW_MS) {
    const seconds = Math.max(1, Math.round((finished.endedAt - finished.startedAt) / 1000))
    return {
      kind: "thinking",
      label: t("transcript.thinkingSeconds", { seconds }),
      thinkingDoneSeconds: seconds,
    }
  }

  if (input.sending && input.phase === "idle")
    return { kind: "tools", label: t("transcript.statusSending") }
  return null
}

export function turnOutputTokens(
  items: readonly TranscriptItem[],
  turnStartId: string | undefined,
): number | null {
  let fromIndex = turnStartId ? items.findIndex((item) => item.id === turnStartId) : -1

  if (fromIndex < 0) {
    fromIndex = items.findLastIndex((item) => item.role === "user")
  }

  let total: number | null = null

  for (let i = fromIndex + 1; i < items.length; i += 1) {
    const item = items[i]

    if (item?.role === "user") break

    if (item?.role !== "assistant") continue
    const output = item.usage?.output

    if (output === undefined) continue
    total = (total ?? 0) + output
  }

  return total
}

/** 1 位小数 k/M/B，千分位 carry（同 cc-wrapper formatOutputTokens）。 */
export function formatOutputTokens(tokens: number): string {
  if (!Number.isSafeInteger(tokens) || tokens < 0) return ""
  const units = ["", "k", "M", "B"]
  let unit = tokens >= 1e9 ? 3 : tokens >= 1e6 ? 2 : tokens >= 1e3 ? 1 : 0

  if (!unit) return String(tokens)

  if (unit < 3 && Number((tokens / 1000 ** unit).toFixed(1)) >= 1000) unit += 1
  return `${(tokens / 1000 ** unit).toFixed(1)}${units[unit]}`
}

export type ActivityKind = NonNullable<TurnActivity>["kind"]

export function createActivityLabelDisplay(opts: {
  debounceMs?: number
  minHoldMs?: number
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (id: unknown) => void
}): {
  update(label: string, kind: ActivityKind | null, busy: boolean): void
  displayed: () => string
  subscribe(listener: () => void): () => void
  destroy(): void
} {
  const debounceMs = opts.debounceMs ?? 150
  const minHoldMs = opts.minHoldMs ?? 650
  const now = opts.now ?? (() => Date.now())
  const setTimer = opts.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer =
    opts.clearTimeout ?? ((id: unknown) => clearTimeout(id as Parameters<typeof clearTimeout>[0]))
  let displayedLabel = ""
  let stableLabel = ""
  let candidateLabel = ""
  let shownAt = 0
  let debounce: unknown
  let hold: unknown
  let generation = 0
  const listeners = new Set<() => void>()

  function clearTimers() {
    generation += 1

    if (debounce !== undefined) clearTimer(debounce)

    if (hold !== undefined) clearTimer(hold)
    debounce = undefined
    hold = undefined
  }

  function publish(label: string) {
    if (displayedLabel === label) return
    displayedLabel = label
    shownAt = now()

    for (const listener of listeners) listener()
  }

  function settle() {
    if (hold !== undefined) clearTimer(hold)
    hold = undefined

    if (stableLabel === displayedLabel) return
    const remaining = Math.max(0, minHoldMs - (now() - shownAt))

    if (!remaining) {
      publish(stableLabel)
      return
    }

    const expected = generation
    hold = setTimer(() => {
      if (expected !== generation) return
      hold = undefined
      publish(stableLabel)
    }, remaining)
  }

  function queueCandidate() {
    if (debounce !== undefined) clearTimer(debounce)

    if (candidateLabel === stableLabel) {
      debounce = undefined
      return
    }

    const expected = generation
    const candidate = candidateLabel
    debounce = setTimer(() => {
      if (expected !== generation) return
      debounce = undefined
      stableLabel = candidate
      settle()
    }, debounceMs)
  }

  let lastKind: ActivityKind | null = null
  return {
    update(label, kind, busy) {
      const ownerChanged = kind !== lastKind
      lastKind = kind

      if (!busy || ownerChanged) {
        clearTimers()
        candidateLabel = label
        stableLabel = label
        publish(label)
        return
      }

      if (label === candidateLabel && label === stableLabel) return
      const first = stableLabel === "" && displayedLabel === ""
      candidateLabel = label

      if (first) {
        stableLabel = label
        publish(label)
        return
      }

      queueCandidate()
    },
    displayed: () => displayedLabel,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    destroy() {
      clearTimers()
      listeners.clear()
    },
  }
}
