import { computed, shallowRef } from "vue"

export type NotificationTone = "neutral" | "info" | "success" | "warning" | "error"

export type NotificationAvatar = { kind: "project"; cwd: string } | { kind: "brand" }

export interface NotificationAction {
  label: string
  primary?: boolean | undefined
  run(): void
}

export interface NotificationItem {
  id: string
  title: string
  body?: string | undefined
  tone: NotificationTone
  createdAt: number
  avatar?: NotificationAvatar | undefined
  sessionId?: string | undefined
  actions?: readonly NotificationAction[] | undefined
  keepUntilResolved: boolean
  onScreen: boolean
  read: boolean
  resolved: boolean
}

export interface PushNotificationInput {
  id?: string | undefined
  title: string
  body?: string | undefined
  tone?: NotificationTone | undefined
  createdAt?: number | undefined
  avatar?: NotificationAvatar | undefined
  sessionId?: string | undefined
  actions?: readonly NotificationAction[] | undefined
  keepUntilResolved?: boolean | undefined
}

const HISTORY_LIMIT = 50

let nextNotifSeq = 0

export const notificationItems = shallowRef<readonly NotificationItem[]>([])
export const notificationAnnouncement = shallowRef("")

export const screenNotifications = computed(() =>
  notificationItems.value.filter((item) => item.onScreen && !item.resolved),
)

export const historyNotifications = computed(() => {
  const unresolved: NotificationItem[] = []
  const regular: NotificationItem[] = []

  for (const item of notificationItems.value) {
    if (item.keepUntilResolved && !item.resolved) unresolved.push(item)
    else regular.push(item)
  }

  return [...unresolved, ...regular]
})

export const unreadNotificationCount = computed(
  () =>
    notificationItems.value.filter(
      (item) => !item.resolved && (item.keepUntilResolved || !item.read),
    ).length,
)

function announce(text: string) {
  notificationAnnouncement.value = ""
  queueMicrotask(() => {
    notificationAnnouncement.value = text
  })
}

function enforceCap(items: NotificationItem[]): NotificationItem[] {
  if (items.length <= HISTORY_LIMIT) return items
  let overflow = items.length - HISTORY_LIMIT
  const kept: NotificationItem[] = []

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]!

    if (overflow > 0 && !(item.keepUntilResolved && !item.resolved)) {
      overflow -= 1
      continue
    }

    kept.push(item)
  }

  return kept.reverse()
}

export function pushNotification(input: PushNotificationInput): string {
  const title = input.title.trim()
  const body = input.body?.trim()
  const id = input.id ?? `notif-${++nextNotifSeq}`
  const item: NotificationItem = {
    id,
    title: title || body || "",
    ...(title && body ? { body } : {}),
    tone: input.tone ?? "info",
    createdAt: input.createdAt ?? Date.now(),
    avatar: input.avatar,
    sessionId: input.sessionId,
    actions: input.actions?.slice(0, 2),
    keepUntilResolved: Boolean(input.keepUntilResolved),
    onScreen: true,
    read: false,
    resolved: false,
  }

  const rest = notificationItems.value.filter((entry) => entry.id !== id)

  notificationItems.value = enforceCap([item, ...rest])
  announce(item.body ? `${item.title}. ${item.body}` : item.title)
  return id
}

export function dismissNotificationScreen(id: string): void {
  notificationItems.value = notificationItems.value.map((item) =>
    item.id === id
      ? {
          ...item,
          onScreen: false,
          read: item.keepUntilResolved ? item.read : true,
        }
      : item,
  )
}

export function resolveNotification(id: string): void {
  notificationItems.value = notificationItems.value.map((item) =>
    item.id === id ? { ...item, onScreen: false, read: true, resolved: true } : item,
  )
}

export function resolveNotificationsForSession(
  sessionId: string,
  predicate?: (item: NotificationItem) => boolean,
): void {
  notificationItems.value = notificationItems.value.map((item) =>
    item.sessionId === sessionId && !item.resolved && (!predicate || predicate(item))
      ? { ...item, onScreen: false, read: true, resolved: true }
      : item,
  )
}

export function clearScreenNotifications(): void {
  notificationItems.value = notificationItems.value.map((item) =>
    item.onScreen
      ? {
          ...item,
          onScreen: false,
          read: item.keepUntilResolved ? item.read : true,
        }
      : item,
  )
}

export function removeNotificationHistory(id: string): void {
  const target = notificationItems.value.find((item) => item.id === id)

  if (!target) return

  if (target.keepUntilResolved && !target.resolved) {
    dismissNotificationScreen(id)
    return
  }

  notificationItems.value = notificationItems.value.filter((item) => item.id !== id)
}

export function clearNotificationHistory(): void {
  notificationItems.value = notificationItems.value.filter(
    (item) => item.keepUntilResolved && !item.resolved,
  )
}

export function markNotificationsRead(): void {
  notificationItems.value = notificationItems.value.map((item) =>
    item.keepUntilResolved || item.read ? item : { ...item, read: true },
  )
}

export function resetNotifications(): void {
  notificationItems.value = []
  notificationAnnouncement.value = ""
}
