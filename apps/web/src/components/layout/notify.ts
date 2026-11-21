import { readonly, shallowRef } from "vue"

export type NoticeLevel = "info" | "warning" | "error"

export interface Notice {
  id: number
  message: string
  level: NoticeLevel
}

const PASSING_MS = 5_000
const notices = shallowRef<Notice[]>([])
let nextId = 1
export const noticeQueue = readonly(notices)

export function dismissNotice(id: number): void {
  notices.value = notices.value.filter((item) => item.id !== id)
}

export function notify(message: string, level: NoticeLevel = "error"): void {
  const text = message.trim()

  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text, level }]

  if (level !== "error") setTimeout(() => dismissNotice(id), PASSING_MS)
}

export function notifyAction(message: string): void {
  notify(message, "error")
}
