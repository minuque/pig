import { readonly, shallowRef } from "vue"

export interface Notice {
  id: number
  message: string
  /** action = 需用户确认/关闭（顶部 banner）。 */
  kind: "action"
}

const notices = shallowRef<Notice[]>([])
let nextId = 1
export const noticeQueue = readonly(notices)

export function dismissNotice(id: number): void {
  notices.value = notices.value.filter((item) => item.id !== id)
}

/** 需要用户知悉/确认：驻留顶部 banner，直到手动关闭。 */
export function notifyAction(message: string): void {
  const text = message.trim()

  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text, kind: "action" }]
}
