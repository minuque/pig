import type { InjectionKey, Ref } from "vue"

export type TabsVariant = "underline" | "segmented"

export const TABS_VARIANT: InjectionKey<Ref<TabsVariant>> = Symbol("tabs-variant")
