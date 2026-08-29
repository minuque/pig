import { readonly, shallowRef } from "vue"

export type NoticeVariant = "error" | "info" | "success" | "warning"

export interface NoticeAction {
  label: string
  onSelect: () => void
}

export interface NoticeOptions {
  title?: string
  action?: NoticeAction
}

export interface Notice extends NoticeOptions {
  id: number
  message: string
  variant: NoticeVariant
}

const DURATION_MS = 5000
const notices = shallowRef<Notice[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

export const noticeQueue = readonly(notices)

export function dismissNotice(id: number): void {
  const timer = timers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(id)
  }
  notices.value = notices.value.filter((item) => item.id !== id)
}

function enqueue(variant: NoticeVariant, message: string, options: NoticeOptions = {}): void {
  const text = message.trim()
  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text, variant, ...options }]
  timers.set(
    id,
    setTimeout(() => dismissNotice(id), DURATION_MS),
  )
}

export const notify = {
  error: (message: string, options?: NoticeOptions) => enqueue("error", message, options),
  info: (message: string, options?: NoticeOptions) => enqueue("info", message, options),
  success: (message: string, options?: NoticeOptions) => enqueue("success", message, options),
  warning: (message: string, options?: NoticeOptions) => enqueue("warning", message, options),
}
