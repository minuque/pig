import { computed, inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import type { ExtensionUiResponse } from "@pig/protocol"
import { t } from "@i18n/index.js"
import type { SessionContext } from "@features/session/index.js"
import { useExtensionUi } from "@features/extension-ui/index.js"
import {
  answered,
  askBoard,
  emptyAnswer,
  extensionBoard,
  formatAskAnswers,
  nextUnanswered,
  type Board,
  type BoardAnswer,
} from "@features/extension-ui/lib/board.js"

const AUTO_NEXT_MS = 200

type BoardSession = Pick<
  SessionContext,
  "sessionId" | "transcript" | "turnPending" | "prompt" | "sendPrompt"
>

function useQuestionBoardState(session: BoardSession) {
  const ui = useExtensionUi()
  const answers = shallowRef(new Map<string, BoardAnswer[]>())
  const positions = shallowRef(new Map<string, number>())
  const done = shallowRef(new Set<string>())
  const labels = () => ({ allow: t("extensionUi.allow"), deny: t("extensionUi.deny") })
  const pending = computed(() =>
    ui.dialogs.value.find((item) => item.sessionId === session.sessionId.value),
  )
  const board = computed<Board | undefined>(() => {
    if (pending.value) return extensionBoard(pending.value.request, labels())

    if (session.turnPending.value) return undefined
    const ask = askBoard(session.transcript.value)
    return ask && !done.value.has(ask.id) ? ask : undefined
  })
  const index = computed(() => (board.value ? (positions.value.get(board.value.id) ?? 0) : 0))
  const question = computed(() => board.value?.questions[index.value])
  const answersOf = (id: string, total: number) =>
    answers.value.get(id) ?? Array.from({ length: total }, emptyAnswer)
  const current = computed(() =>
    board.value ? answersOf(board.value.id, board.value.questions.length) : [],
  )
  const complete = computed(
    () => current.value.length > 0 && current.value.every((answer) => answered(answer)),
  )
  let stash: string | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function setAnswer(next: BoardAnswer) {
    const active = board.value

    if (!active) return
    const list = [...answersOf(active.id, active.questions.length)]
    list[index.value] = next
    answers.value = new Map(answers.value).set(active.id, list)
  }

  function go(next: number) {
    const active = board.value

    if (!active || next < 0 || next >= active.questions.length) return
    positions.value = new Map(positions.value).set(active.id, next)
  }

  watch(
    () => board.value?.id,
    (id, previous) => {
      if (id && previous === undefined) stash = session.prompt.value

      if (!id) {
        if (stash !== undefined) session.prompt.value = stash
        stash = undefined
      }
    },
    { immediate: true },
  )

  watch(
    () => [board.value?.id, index.value] as const,
    () => {
      const q = question.value

      if (q) session.prompt.value = current.value[index.value]?.text || q.prefill || ""
    },
    { immediate: true },
  )

  watch(session.prompt, (value) => {
    const q = question.value
    const answer = current.value[index.value]

    if (!q || q.reply === "none" || !answer || answer.text === value) return
    setAnswer({ picked: value.trim() ? [] : answer.picked, text: value })
  })

  function respond(response: ExtensionUiResponse) {
    if (pending.value) void ui.answer(pending.value, response)
  }

  function finishAsk(text: string) {
    const active = board.value

    if (!active) return
    done.value = new Set(done.value).add(active.id)
    void session.sendPrompt(text)
  }

  function pick(position: number) {
    const active = board.value
    const q = question.value
    const option = q?.options[position]

    if (!active || !q || !option) return

    if (active.source === "extension") {
      const request = pending.value?.request
      return respond(
        request?.method === "confirm"
          ? { id: active.id, confirmed: position === 1 }
          : { id: active.id, value: option.label },
      )
    }

    const answer = current.value[index.value] ?? emptyAnswer()
    const picked = q.multiple
      ? answer.picked.includes(option.label)
        ? answer.picked.filter((label) => label !== option.label)
        : [...answer.picked, option.label]
      : [option.label]

    setAnswer({ picked, text: "" })
    session.prompt.value = ""

    if (q.multiple) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const next = nextUnanswered(current.value, active.questions.length, index.value)

      if (next !== undefined) go(next)
    }, AUTO_NEXT_MS)
  }

  function submit() {
    const active = board.value

    if (!active) return

    if (active.source === "extension") {
      const q = question.value
      return q && q.reply !== "none"
        ? respond({ id: active.id, value: session.prompt.value })
        : undefined
    }

    const next = nextUnanswered(current.value, active.questions.length, index.value)

    if (next !== undefined) return go(next)
    finishAsk(formatAskAnswers(active.questions, current.value))
  }

  function skip() {
    const active = board.value

    if (!active) return

    if (active.source === "ask") return finishAsk(t("extensionUi.askSkipped"))
    const request = pending.value?.request
    respond(
      request?.method === "confirm"
        ? { id: active.id, confirmed: false }
        : { id: active.id, cancelled: true },
    )
  }

  const composer = computed(() => {
    const active = board.value
    const q = question.value

    if (!active || !q) return undefined

    if (q.reply === "none")
      return {
        locked: true,
        placeholder: t("extensionUi.pickAbove"),
        label: t("extensionUi.pick"),
        ready: false,
      }

    if (active.source === "extension")
      return {
        locked: false,
        placeholder: q.placeholder,
        label: t("extensionUi.submit"),
        ready: true,
      }
    return {
      locked: false,
      placeholder: undefined,
      label: complete.value ? t("extensionUi.submit") : t("extensionUi.nextQuestion"),
      ready: answered(current.value[index.value]) || complete.value,
    }
  })
  return { board, question, index, current, complete, composer, go, pick, submit, skip }
}

export type QuestionBoardContext = ReturnType<typeof useQuestionBoardState>

const key: InjectionKey<QuestionBoardContext> = Symbol("question-board")

export function provideQuestionBoard(session: BoardSession) {
  const state = useQuestionBoardState(session)
  provide(key, state)
  return state
}

export function useQuestionBoard(): QuestionBoardContext {
  const state = inject(key)

  if (!state) throw new Error("useQuestionBoard() 需要先 provideQuestionBoard()")
  return state
}
