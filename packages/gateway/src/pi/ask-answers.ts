import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import {
  ASK_ANSWERS_ENTRY,
  ASK_TOOL,
  type AskAnswer,
  type JsonValue,
  type TranscriptItem,
} from "@pig/protocol"

const KINDS = new Set<AskAnswer["kind"]>(["option", "custom", "multi"])

function parseAnswer(value: unknown): AskAnswer | undefined {
  if (!value || typeof value !== "object") return undefined
  const raw = value as Record<string, unknown>

  if (
    typeof raw.questionIndex !== "number" ||
    !Number.isInteger(raw.questionIndex) ||
    raw.questionIndex < 0 ||
    typeof raw.question !== "string" ||
    !KINDS.has(raw.kind as AskAnswer["kind"]) ||
    (raw.answer !== null && typeof raw.answer !== "string")
  )
    return undefined
  const selected = Array.isArray(raw.selected)
    ? raw.selected.filter((item): item is string => typeof item === "string")
    : undefined
  return {
    questionIndex: raw.questionIndex,
    question: raw.question,
    kind: raw.kind as AskAnswer["kind"],
    answer: raw.answer,
    ...(selected ? { selected } : {}),
  }
}

export function parseAskAnswers(value: unknown): AskAnswer[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const answers = value.flatMap((item) => parseAnswer(item) ?? [])
  return answers.length === value.length ? answers : undefined
}

function readAskAnswers(entries: readonly SessionEntry[]): Map<string, AskAnswer[]> {
  const found = new Map<string, AskAnswer[]>()

  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== ASK_ANSWERS_ENTRY) continue
    const data = entry.data as { toolCallId?: unknown; answers?: unknown } | undefined
    const answers = parseAskAnswers(data?.answers)

    if (typeof data?.toolCallId === "string" && answers) found.set(data.toolCallId, answers)
  }

  return found
}

export function withAskAnswers(
  items: TranscriptItem[],
  entries: readonly SessionEntry[],
): TranscriptItem[] {
  const recorded = readAskAnswers(entries)

  if (recorded.size === 0) return items
  return items.map((item) => {
    if (item.role !== "tool" || item.toolName !== ASK_TOOL) return item
    const answers = recorded.get(item.toolCallId)

    if (!answers || item.details !== undefined) return item
    return { ...item, details: { answers, cancelled: false } as unknown as JsonValue }
  })
}
