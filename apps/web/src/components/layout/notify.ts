import { readonly, shallowRef } from "vue"

export interface Notice {
  id: number
  message: string
  /** action = 需用户确认/关闭（顶部 banner）；info = 瞬时提示（角落 inbox）。 */
  kind: "action" | "info"
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

function push(message: string, kind: Notice["kind"], autoDismiss: boolean): void {
  const text = message.trim()

  if (!text) return
  const id = nextId
  nextId += 1
  notices.value = [...notices.value, { id, message: text, kind }]

  if (autoDismiss) {
    timers.set(
      id,
      setTimeout(() => dismissNotice(id), DURATION_MS),
    )
  }
}

/** 瞬时提示：自动消失，进角落 inbox。 */
export function notifyInfo(message: string): void {
  push(message, "info", true)
}

/** 需要用户知悉/确认：驻留顶部 banner，直到手动关闭。 */
export function notifyAction(message: string): void {
  push(message, "action", false)
}

/** 兼容旧调用：错误默认按「需确认」处理，不静默消失。 */
export function notifyError(message: string): void {
  notifyAction(message)
}
