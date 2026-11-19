import type { InjectionKey, Ref } from "vue"

export type TabsVariant = "underline" | "segmented"

/** TabsList 把外观传给 TabsTrigger，两种外观的触发器结构不同 */
export const TABS_VARIANT: InjectionKey<Ref<TabsVariant>> = Symbol("tabs-variant")
