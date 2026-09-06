import { readonly, shallowRef } from "vue"

export interface Notice {
  id: number
  message: string
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

export function notifyError(message: string): void {
  const text = message.trim()
  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text }]
  timers.set(
    id,
    setTimeout(() => dismissNotice(id), DURATION_MS),
  )
}
