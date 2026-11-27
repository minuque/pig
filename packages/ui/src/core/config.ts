import {
  computed,
  inject,
  provide,
  toValue,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
} from "vue"

export interface UiLabels {
  close: string
  navigate: string
  select: string
  notifications: string
  notificationsEmpty: string
  openNotifications: string
  clearAll: string
  dismiss: string
  error: string
  justNow: string
}

export const DEFAULT_UI_LABELS: UiLabels = {
  close: "Close",
  navigate: "Navigate",
  select: "Select",
  notifications: "Notifications",
  notificationsEmpty: "No notifications",
  openNotifications: "Notifications",
  clearAll: "Clear all",
  dismiss: "Dismiss",
  error: "Error",
  justNow: "Just now",
}
const UI_LABELS_KEY: InjectionKey<ComputedRef<UiLabels>> = Symbol("pig-ui-labels")
const FALLBACK_LABELS: ComputedRef<UiLabels> = computed(() => DEFAULT_UI_LABELS)

export function provideUiLabels(
  labels: MaybeRefOrGetter<Partial<UiLabels>>,
): ComputedRef<UiLabels> {
  const resolved = computed(() => ({
    ...DEFAULT_UI_LABELS,
    ...toValue(labels),
  }))

  provide(UI_LABELS_KEY, resolved)
  return resolved
}

export function useUiLabels(): ComputedRef<UiLabels> {
  return inject(UI_LABELS_KEY, FALLBACK_LABELS)
}
