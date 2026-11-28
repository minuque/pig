import {
  ASK_TOOL,
  type AskAnswer,
  type ExtensionUiDialog,
  type JsonValue,
  type TranscriptItem,
} from "@pig/protocol"

export interface BoardOption {
  label: string
  description?: string | undefined
}

export interface BoardQuestion {
  header: string
  question: string
  message?: string | undefined
  options: BoardOption[]
  multiple: boolean
  reply: "none" | "free" | "line" | "multiline"
  placeholder?: string | undefined
  prefill?: string | undefined
}

export interface Board {
  source: "extension" | "ask"
  id: string
  questions: BoardQuestion[]
}

export interface BoardAnswer {
  picked: string[]
  text: string
}

export const emptyAnswer = (): BoardAnswer => ({ picked: [], text: "" })
export const answered = (answer: BoardAnswer | undefined) =>
  Boolean(answer && (answer.picked.length > 0 || answer.text.trim()))

export function extensionBoard(
  dialog: ExtensionUiDialog,
  labels: { allow: string; deny: string },
): Board {
  const base = { header: dialog.title, question: dialog.title, multiple: false }
  const question: BoardQuestion =
    dialog.method === "select"
      ? { ...base, options: dialog.options.map((label) => ({ label })), reply: "none" }
      : dialog.method === "confirm"
        ? {
            ...base,
            message: dialog.message,
            options: [{ label: labels.deny }, { label: labels.allow }],
            reply: "none",
          }
        : dialog.method === "input"
          ? { ...base, options: [], reply: "line", placeholder: dialog.placeholder }
          : { ...base, options: [], reply: "multiline", prefill: dialog.prefill }
  return { source: "extension", id: dialog.id, questions: [question] }
}

const record = (value: JsonValue | undefined) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : undefined
const text = (value: JsonValue | undefined) => (typeof value === "string" ? value : "")

function askQuestion(raw: JsonValue): BoardQuestion | undefined {
  const item = record(raw)
  const question = text(item?.question)

  if (!item || !question) return undefined

  const options = (Array.isArray(item.options) ? item.options : []).flatMap((entry) => {
    const option = record(entry)
    const label = text(option?.label)
    return label ? [{ label, description: text(option?.description) || undefined }] : []
  })
  return {
    header: text(item.header) || question,
    question,
    options,
    multiple: item.multiSelect === true,
    reply: item.allowCustom === false ? "none" : "free",
  }
}

export function askBoard(items: readonly TranscriptItem[]): Board | undefined {
  const index = items.findLastIndex((item) => item.role === "tool" && item.toolName === ASK_TOOL)
  const call = items[index]

  if (call?.role !== "tool" || items.slice(index + 1).some((item) => item.role !== "system"))
    return undefined
  const raw = record(call.input)?.questions
  const questions = (Array.isArray(raw) ? raw : []).flatMap((entry) => askQuestion(entry) ?? [])
  return questions.length ? { source: "ask", id: call.toolCallId, questions } : undefined
}

export function formatAskAnswers(
  questions: readonly BoardQuestion[],
  answers: readonly BoardAnswer[],
) {
  return questions
    .map((question, index) => {
      const answer = answers[index] ?? emptyAnswer()
      const value = answer.text.trim() || answer.picked.join("、")
      return `${question.header}：${value}`
    })
    .join("\n")
}

export function askAnswers(
  questions: readonly BoardQuestion[],
  answers: readonly BoardAnswer[],
): AskAnswer[] {
  return questions.map((question, questionIndex) => {
    const { picked, text } = answers[questionIndex] ?? emptyAnswer()
    const typed = text.trim()
    const base = { questionIndex, question: question.question }

    if (question.multiple)
      return { ...base, kind: "multi", answer: typed || null, selected: picked }

    if (typed) return { ...base, kind: "custom", answer: typed }
    return { ...base, kind: "option", answer: picked[0] ?? null }
  })
}

export function nextUnanswered(answers: readonly BoardAnswer[], total: number, from: number) {
  for (let step = 1; step <= total; step += 1) {
    const index = (from + step) % total

    if (!answered(answers[index])) return index
  }

  return undefined
}
