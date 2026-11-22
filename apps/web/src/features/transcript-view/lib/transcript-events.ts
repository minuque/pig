import type { ModelRef, SystemTranscriptItem } from "@/types/common-type.js"
import type {
  AlertRow,
  AssistantRow,
  EventPart,
  EventRow,
  ModelSetting,
  TimelineRow,
} from "@features/transcript-view/type.js"

function eventRow(id: string, timestamp: number, part: EventPart): EventRow {
  return { id, role: "event", parts: [part], timestamp }
}

function sameModel(a: ModelRef | undefined, b: ModelRef | undefined) {
  return a?.provider === b?.provider && a?.id === b?.id
}

export function settingChanged(from: ModelSetting, to: ModelSetting) {
  return {
    model: from.model !== undefined && to.model !== undefined && !sameModel(from.model, to.model),
    thinkingLevel:
      from.thinkingLevel !== undefined &&
      to.thinkingLevel !== undefined &&
      from.thinkingLevel !== to.thinkingLevel,
  }
}

function appendSettingChange(
  rows: TimelineRow[],
  item: SystemTranscriptItem,
  from: ModelSetting,
  to: ModelSetting,
) {
  const last = rows.at(-1)
  const part = last?.role === "event" ? last.parts.at(-1) : undefined

  if (last?.role !== "event" || part?.kind !== "model") {
    rows.push(eventRow(`event:${item.id}`, item.timestamp, { kind: "model", from, to }))
    return
  }

  const merged: EventPart = {
    kind: "model",
    from: {
      ...from,
      ...(part.from.model ? { model: part.from.model } : {}),
      ...(part.from.thinkingLevel ? { thinkingLevel: part.from.thinkingLevel } : {}),
    },
    to: { ...part.to, ...to },
  }
  const changed = settingChanged(merged.from, merged.to)
  const parts = last.parts.slice(0, -1)

  if (changed.model || changed.thinkingLevel) parts.push(merged)

  if (parts.length) rows[rows.length - 1] = { ...last, parts }
  else rows.pop()
}

export function appendSystemRow(rows: TimelineRow[], item: SystemTranscriptItem) {
  const { event, id, timestamp } = item
  const model = "model" in event && event.model ? { model: event.model } : {}

  switch (event.kind) {
    case "model_change":
      return appendSettingChange(rows, item, { model: event.previous }, { model: event.model })
    case "thinking_level_change":
      return appendSettingChange(
        rows,
        item,
        { ...model, thinkingLevel: event.previous },
        { ...model, thinkingLevel: event.thinkingLevel },
      )
    case "compaction":
      rows.push(
        eventRow(`event:${id}`, timestamp, {
          kind: "compaction",
          tokensBefore: event.tokensBefore,
          summary: event.summary,
        }),
      )
      return
    case "branch_summary":
      rows.push(
        eventRow(`event:${id}`, timestamp, { kind: "branch_summary", summary: event.summary }),
      )
      return
    case "compaction_failed":
      rows.push(
        eventRow(`event:${id}`, timestamp, {
          kind: "compaction_failed",
          errorMessage: event.errorMessage,
        }),
      )
      return

    case "extension_message":
      rows.push({
        id: `extension:${id}`,
        role: "extension",
        customType: event.customType,
        text: event.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(""),
        images: event.content.flatMap((part) =>
          part.type === "image" ? [{ data: part.data, mimeType: part.mimeType }] : [],
        ),
        timestamp,
      })
      return
    case "extension_notice":
      rows.push({
        id: `notice:${id}`,
        role: "alert",
        source: "extension",
        level: event.level,
        message: event.message,
        retries: 0,
        timestamp,
      })
  }
}

function requestAlert(row: AssistantRow, retries: number): AlertRow {
  return {
    id: `alert:${row.id}`,
    role: "alert",
    source: "request",
    level: "error",
    message: row.errorMessage ?? "",
    retries,
    timestamp: row.timestamp,
  }
}

function lastWorkIndex(rows: readonly TimelineRow[]) {
  return rows.findLastIndex(
    (row) => row.role === "assistant" || row.role === "tools" || row.role === "task",
  )
}

function mergeAdjacentEvents(rows: readonly TimelineRow[]): TimelineRow[] {
  const merged: TimelineRow[] = []

  for (const row of rows) {
    const last = merged.at(-1)

    if (row.role === "event" && last?.role === "event")
      merged[merged.length - 1] = { ...last, parts: [...last.parts, ...row.parts] }
    else merged.push(row)
  }

  return merged
}

export function settleTurnOutcome(
  rows: readonly TimelineRow[],
  options: { live: boolean; abortedTurn: boolean },
): TimelineRow[] {
  const settled: TimelineRow[] = []
  let failures: AssistantRow[] = []
  let aborted = false
  const flushFailures = (recovered: boolean) => {
    const first = failures[0]
    const last = failures.at(-1)

    if (!first || !last) return

    if (recovered)
      settled.push(
        eventRow(`retry:${first.id}`, first.timestamp, {
          kind: "retry_recovered",
          attempts: failures.map((row) => ({
            timestamp: row.timestamp,
            errorMessage: row.errorMessage ?? "",
          })),
        }),
      )
    else settled.push(requestAlert(last, failures.length - 1))
    failures = []
  }

  for (const row of rows) {
    if (row.role === "assistant" && row.error) {
      if (row.text) settled.push(row)
      failures.push(row)
      continue
    }

    if (row.role === "assistant" && row.aborted) {
      flushFailures(false)

      if (row.text) settled.push(row)
      aborted = true
      settled.push(eventRow(`aborted:${row.id}`, row.timestamp, { kind: "aborted" }))
      continue
    }

    flushFailures(row.role === "assistant" || row.role === "tools")
    settled.push(row)
  }

  if (!options.live) flushFailures(false)

  if (options.abortedTurn && !aborted) {
    const at = lastWorkIndex(settled) + 1
    const anchor = settled[at - 1]
    const timestamp = anchor && "timestamp" in anchor ? anchor.timestamp : 0
    settled.splice(
      at,
      0,
      eventRow(`aborted:${anchor?.id ?? "turn"}`, timestamp, { kind: "aborted" }),
    )
  }

  return mergeAdjacentEvents(settled)
}
