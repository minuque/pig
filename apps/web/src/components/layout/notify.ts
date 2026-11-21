import { readonly, shallowRef } from "vue"

export type NoticeLevel = "info" | "success" | "warning" | "error"

export interface NoticeAction {
  label: string
  run(): void
}

export interface Notice {
  id: number
  message: string
  level: NoticeLevel
  title?: string | undefined
  action?: NoticeAction | undefined
  transient?: boolean | undefined
  open: boolean
}

const notices = shallowRef<Notice[]>([])
let nextId = 1
export const noticeQueue = readonly(notices)

export function dismissNotice(id: number): void {
  notices.value = notices.value.map((item) => (item.id === id ? { ...item, open: false } : item))
}

export function notify(
  message: string,
  level: NoticeLevel = "error",
  extra: Pick<Notice, "title" | "action" | "transient"> = {},
): void {
  const text = message.trim()

  if (!text) return
  notices.value = [
    ...notices.value.filter((item) => item.open),
    { id: nextId++, message: text, level, ...extra, open: true },
  ]
}

export function notifyAction(message: string): void {
  notify(message, "error")
}
