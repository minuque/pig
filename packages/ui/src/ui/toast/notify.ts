import { computed, shallowRef } from "vue"

export type ToastTone = "accent" | "success" | "info" | "warning" | "error"

export type ToastKind = "status" | "action" | "progress"

export interface ToastAction {
  label: string
  icon?: "undo" | "open" | "retry" | undefined
  revertedLabel?: string | undefined
  run(): void | boolean | Promise<void | boolean>
}

export interface ActiveToast {
  id: string
  seq: number
  kind: ToastKind
  tone: ToastTone
  message: string
  sheen: boolean
  action?: ToastAction | undefined
  onExpire?: (() => void) | undefined
  durationMs: number
}

export interface ToastStatusOptions {
  id?: string | undefined
  tone?: ToastTone | undefined
  duration?: number | undefined
}

export interface ToastActionOptions {
  id?: string | undefined
  tone?: ToastTone | undefined
  duration?: number | undefined
  onExpire?: (() => void) | undefined
}

export interface ToastProgressHandle {
  readonly id: string
  update(patch: { message?: string | undefined; tone?: ToastTone | undefined }): void
  finish(result: {
    message: string
    tone?: ToastTone | undefined
    duration?: number | undefined
    action?: Omit<ToastAction, "revertedLabel"> | undefined
  }): void
  dismiss(): void
}

const MIN_STATUS_MS = 3_000
const MAX_STATUS_MS = 5_000
const REVERTED_MS = 1_500
const ACTION_MIN_MS = 5_000
const PROGRESS_DONE_MS = 3_000
const PROGRESS_HOLD_MS = 4_000
const TICK_MS = 100

let idSeq = 0
let toastSeq = 0
let expireTimer: ReturnType<typeof setTimeout> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined
let deadline = 0

export const activeToast = shallowRef<ActiveToast | null>(null)
export const toastRemainingMs = shallowRef(0)
export const toastPaused = shallowRef(false)
export const toastAnnouncement = shallowRef("")
export const toastDurationMs = computed(() => activeToast.value?.durationMs ?? 0)

function clearTimers() {
  if (expireTimer !== undefined) {
    clearTimeout(expireTimer)
    expireTimer = undefined
  }

  if (tickTimer !== undefined) {
    clearInterval(tickTimer)
    tickTimer = undefined
  }
}

function nextId(): string {
  idSeq += 1
  return `toast-${idSeq}`
}

export function statusDuration(text: string, explicit?: number): number {
  if (explicit !== undefined && explicit > 0) return explicit
  return Math.min(
    MAX_STATUS_MS,
    Math.max(MIN_STATUS_MS, MIN_STATUS_MS + Math.max(0, text.length - 12) * 80),
  )
}

function announce(text: string) {
  toastAnnouncement.value = ""
  queueMicrotask(() => {
    toastAnnouncement.value = text
  })
}

function armTimer(ms: number) {
  clearTimers()

  if (!Number.isFinite(ms)) {
    toastRemainingMs.value = 0
    return
  }

  toastRemainingMs.value = ms

  if (toastPaused.value) return

  deadline = Date.now() + ms
  expireTimer = setTimeout(() => {
    expireCurrent()
  }, ms)

  if (activeToast.value?.kind === "action") {
    tickTimer = setInterval(() => {
      if (toastPaused.value) return
      toastRemainingMs.value = Math.max(0, deadline - Date.now())
    }, TICK_MS)
  }
}

function expireCurrent() {
  const current = activeToast.value

  clearTimers()
  toastRemainingMs.value = 0

  if (!current) return
  activeToast.value = null
  current.onExpire?.()
}

function replaceToast(next: ActiveToast) {
  const previous = activeToast.value

  clearTimers()
  toastPaused.value = false

  if (previous && previous.id !== next.id) previous.onExpire?.()

  activeToast.value = next
  announce(next.message)
  armTimer(next.durationMs)
}

export function toastStatus(message: string, options: ToastStatusOptions = {}): string | undefined {
  const text = message.trim()

  if (!text) return undefined

  const tone = options.tone ?? "accent"
  const id = options.id ?? nextId()
  const durationMs = statusDuration(text, options.duration)

  toastSeq += 1
  replaceToast({
    id,
    seq: toastSeq,
    kind: "status",
    tone,
    message: text,
    sheen: tone === "accent" || tone === "success" || tone === "info",
    durationMs,
  })
  return id
}

export function toastAction(
  message: string,
  action: ToastAction,
  options: ToastActionOptions = {},
): string | undefined {
  const text = message.trim()

  if (!text) return undefined

  const id = options.id ?? nextId()
  const durationMs = Math.max(ACTION_MIN_MS, options.duration ?? ACTION_MIN_MS)

  toastSeq += 1
  replaceToast({
    id,
    seq: toastSeq,
    kind: "action",
    tone: options.tone ?? "accent",
    message: text,
    sheen: false,
    action,
    onExpire: options.onExpire,
    durationMs,
  })
  return id
}

export function toastProgress(
  message: string,
  options: { id?: string | undefined } = {},
): ToastProgressHandle {
  const text = message.trim()
  const id = options.id ?? nextId()

  if (text) {
    toastSeq += 1
    replaceToast({
      id,
      seq: toastSeq,
      kind: "progress",
      tone: "info",
      message: text,
      sheen: false,
      durationMs: Number.POSITIVE_INFINITY,
    })
  }

  return {
    id,
    update(patch) {
      const current = activeToast.value

      if (!current || current.id !== id || current.kind !== "progress") return

      const nextMessage = patch.message !== undefined ? patch.message.trim() : current.message

      if (!nextMessage) return

      activeToast.value = {
        ...current,
        message: nextMessage,
        ...(patch.tone ? { tone: patch.tone } : {}),
      }
      announce(nextMessage)
    },
    finish(result) {
      const textDone = result.message.trim()
      const current = activeToast.value
      const sameToast = current?.id === id

      if (!sameToast && result.tone !== "error") return

      if (!textDone) {
        if (sameToast) dismissToast(id)
        return
      }

      const tone = result.tone ?? "success"
      const kind: ToastKind = result.action ? "action" : "status"
      const durationMs =
        result.duration ?? (tone === "error" || result.action ? PROGRESS_HOLD_MS : PROGRESS_DONE_MS)

      clearTimers()
      toastPaused.value = false
      toastSeq += 1

      const next: ActiveToast = {
        id,
        seq: toastSeq,
        kind,
        tone,
        message: textDone,
        sheen: tone !== "error" && kind === "status",
        action: result.action,
        durationMs,
      }

      if (sameToast) {
        activeToast.value = next
        announce(next.message)
        armTimer(next.durationMs)
      } else {
        replaceToast(next)
      }
    },
    dismiss() {
      dismissToast(id)
    },
  }
}

export function dismissToast(id?: string): void {
  const current = activeToast.value

  if (!current || (id !== undefined && current.id !== id)) return

  expireCurrent()
}

export function pauseToast(): void {
  const current = activeToast.value

  if (!current || !Number.isFinite(current.durationMs) || toastPaused.value) return

  toastPaused.value = true
  toastRemainingMs.value = Math.max(0, deadline - Date.now())
  clearTimers()
}

export function resumeToast(): void {
  const current = activeToast.value

  if (!current || !toastPaused.value) return

  toastPaused.value = false
  armTimer(toastRemainingMs.value)
}

export async function triggerToastAction(): Promise<void> {
  const current = activeToast.value

  if (!current?.action) return

  const action = current.action

  clearTimers()
  toastRemainingMs.value = 0

  let outcome: unknown
  try {
    outcome = await action.run()
  } catch {
    if (activeToast.value?.id === current.id) {
      activeToast.value = null
      toastPaused.value = false
    }
    return
  }

  if (activeToast.value?.id !== current.id) return

  if (outcome !== false && action.revertedLabel) {
    toastSeq += 1
    toastPaused.value = false
    const morphed: ActiveToast = {
      id: current.id,
      seq: toastSeq,
      kind: "status",
      tone: "accent",
      message: action.revertedLabel,
      sheen: true,
      durationMs: REVERTED_MS,
    }
    activeToast.value = morphed
    announce(morphed.message)
    armTimer(REVERTED_MS)
    return
  }

  activeToast.value = null
  toastPaused.value = false
}

export function resetToasts(): void {
  clearTimers()
  activeToast.value = null
  toastRemainingMs.value = 0
  toastPaused.value = false
  toastAnnouncement.value = ""
}
