import { readonly, shallowRef } from "vue"

export type NoticeLevel = "info" | "warning" | "error"

export interface Notice {
  id: number
  message: string
  level: NoticeLevel
}

/** 非错误的提示停留这么久后自动收起；错误驻留到手动关闭。 */
const PASSING_MS = 5_000
const notices = shallowRef<Notice[]>([])
let nextId = 1
export const noticeQueue = readonly(notices)

export function dismissNotice(id: number): void {
  notices.value = notices.value.filter((item) => item.id !== id)
}

/** 顶部 banner 提示；扩展的 ctx.ui.notify 也走这里。 */
export function notify(message: string, level: NoticeLevel = "error"): void {
  const text = message.trim()

  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text, level }]

  if (level !== "error") setTimeout(() => dismissNotice(id), PASSING_MS)
}

/** 需要用户知悉/确认的错误：驻留顶部 banner，直到手动关闭。 */
export function notifyAction(message: string): void {
  notify(message, "error")
}
