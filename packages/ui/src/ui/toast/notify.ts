import { createToaster, type ToastData } from "@ui-sdk/vue/toast"

export type NoticeLevel = "info" | "success" | "warning" | "error" | "waiting"

export interface NoticeAction {
  label: string
  icon?: "open" | "undo"
  run(): void
}

export interface NoticeExtra {
  id?: string | undefined
  title?: string | undefined
  action?: NoticeAction | undefined
  transient?: boolean | undefined
}

export interface Notice {
  message: string
  level: NoticeLevel
  title?: string | undefined
  action?: NoticeAction | undefined
}

export const PASSING_MS = 5_000
export const noticeToaster = createToaster({ duration: PASSING_MS })

export function noticeOf(toast: ToastData): Notice {
  return toast.data as Notice
}

export function notify(
  message: string,
  level: NoticeLevel = "error",
  extra: NoticeExtra = {},
): void {
  const text = message.trim()

  if (!text) return

  const { action, id, title, transient } = extra
  const notice: Notice = { message: text, level, title, action }
  noticeToaster({
    ...(id && { id }),
    title: title ?? text,
    ...(title && { description: text }),
    type: level === "waiting" ? "warning" : level,
    duration: (level === "error" || level === "waiting") && !transient ? Infinity : PASSING_MS,
    data: notice,
    ...(action && { action: { label: action.label, onAction: () => action.run() } }),
  })
}

export function dismissNotice(id: string): void {
  noticeToaster.dismiss(id)
}

export function notifyAction(message: string): void {
  notify(message, "error")
}
