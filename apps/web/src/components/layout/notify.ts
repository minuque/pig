import { createToaster, type ToastData } from "@ui-sdk/vue/toast"

export type NoticeLevel = "info" | "success" | "warning" | "error"

export interface NoticeAction {
  label: string
  icon?: "open" | "undo"
  run(): void
}

export interface NoticeExtra {
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

  const { action, title, transient } = extra
  const notice: Notice = { message: text, level, title, action }
  noticeToaster({
    title: title ?? text,
    ...(title && { description: text }),
    type: level,
    duration: level === "error" && !transient ? Infinity : PASSING_MS,
    data: notice,
    ...(action && { action: { label: action.label, onAction: () => action.run() } }),
  })
}

export function notifyAction(message: string): void {
  notify(message, "error")
}
