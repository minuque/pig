import { ASK_TOOL, type AskAnswer, type JsonValue } from "@pig/protocol"
import type { TranscriptItem } from "@/types/common-type.js"
import type { AskRecordLine } from "@features/transcript-view/type.js"
import { userMessageText } from "@features/session/lib/transcript-text.js"

type AskedQuestion = { header: string; question: string; labels: string[]; multiple: boolean }

export interface AskRecords {
  lines: Map<string, AskRecordLine[]>
  folded: Set<string>
}

const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
const text = (value: unknown) => (typeof value === "string" ? value : "")

function askedQuestions(input: JsonValue): AskedQuestion[] {
  const raw = record(input)?.questions
  return (Array.isArray(raw) ? raw : []).flatMap((entry) => {
    const item = record(entry)
    const question = text(item?.question)

    if (!item || !question) return []
    const labels = (Array.isArray(item.options) ? item.options : [])
      .map((option) => text(record(option)?.label))
      .filter(Boolean)
    return [
      {
        header: text(item.header) || question,
        question,
        labels,
        multiple: item.multiSelect === true,
      },
    ]
  })
}

function detailAnswers(details: JsonValue | undefined): AskAnswer[] | undefined {
  const raw = record(details)

  if (!raw || raw.cancelled === true || !Array.isArray(raw.answers)) return undefined
  const answers = raw.answers.flatMap((entry) => {
    const item = record(entry)
    const kind = item?.kind

    if (
      !item ||
      typeof item.questionIndex !== "number" ||
      (kind !== "option" && kind !== "custom" && kind !== "multi")
    )
      return []
    const selected = Array.isArray(item.selected) ? item.selected.map(text).filter(Boolean) : []
    return [
      {
        questionIndex: item.questionIndex,
        question: text(item.question),
        kind,
        answer: typeof item.answer === "string" ? item.answer : null,
        selected,
      } satisfies AskAnswer,
    ]
  })
  return answers.length ? answers : undefined
}

function replyAnswers(reply: string, questions: AskedQuestion[]): AskAnswer[] | undefined {
  const lines = reply.split("\n")

  if (!questions.length || lines.length !== questions.length) return undefined
  const answers: AskAnswer[] = []

  for (const [questionIndex, question] of questions.entries()) {
    const prefix = `${question.header}：`
    const line = lines[questionIndex]

    if (!line?.startsWith(prefix)) return undefined
    const value = line.slice(prefix.length)
    const parts = value.split("、")
    const picked = parts.every((part) => question.labels.includes(part)) ? parts : []
    const base = { questionIndex, question: question.question }

    if (question.multiple)
      answers.push({
        ...base,
        kind: "multi",
        answer: picked.length ? null : value,
        selected: picked,
      })
    else if (picked.length) answers.push({ ...base, kind: "option", answer: value })
    else answers.push({ ...base, kind: "custom", answer: value })
  }

  return answers
}

function recordLines(questions: AskedQuestion[], answers: AskAnswer[]): AskRecordLine[] {
  return answers.flatMap((answer) => {
    const asked = questions[answer.questionIndex]
    const picked =
      answer.kind === "multi"
        ? (answer.selected ?? [])
        : answer.kind === "option" && answer.answer
          ? [answer.answer]
          : []
    const typed = answer.kind === "option" ? "" : (answer.answer ?? "")
    const chosen = [...picked, typed].filter(Boolean).join("、")

    if (!chosen) return []
    return [
      {
        question: asked?.question || answer.question,
        chosen,
        others: (asked?.labels ?? []).filter((label) => !picked.includes(label)),
      },
    ]
  })
}

export function askRecords(items: readonly TranscriptItem[]): AskRecords {
  const records: AskRecords = { lines: new Map(), folded: new Set() }

  for (const [index, item] of items.entries()) {
    if (item.role !== "tool" || item.toolName !== ASK_TOOL || item.status === "running") continue
    const questions = askedQuestions(item.input)
    const reply = items.slice(index + 1).find((next) => next.role !== "system")
    const replied =
      reply?.role === "user" ? replyAnswers(userMessageText(reply), questions) : undefined

    if (replied && reply) records.folded.add(reply.id)
    const answers = detailAnswers(item.details) ?? replied
    const lines = answers ? recordLines(questions, answers) : []

    if (lines.length) records.lines.set(item.toolCallId, lines)
  }

  return records
}

export function turnAsksKey(
  user: TranscriptItem | undefined,
  rest: readonly TranscriptItem[],
  asks: AskRecords,
) {
  const lines = rest.flatMap((item) =>
    item.role === "tool" && asks.lines.has(item.toolCallId)
      ? [asks.lines.get(item.toolCallId)]
      : [],
  )
  return JSON.stringify([user ? asks.folded.has(user.id) : false, lines])
}
