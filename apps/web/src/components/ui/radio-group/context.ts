import type { ComputedRef, InjectionKey } from "vue"
import type { Size } from "@components/ui/rt/size.js"

export interface RadioGroupContext {
  size: Size
  variant: "classic" | "surface" | "soft"
}

/** 单选组把尺寸与变体传给它下面的 Radio：rt 的外观类要落在 Radio 自己身上。 */
export const RADIO_GROUP_KEY: InjectionKey<ComputedRef<RadioGroupContext>> =
  Symbol("radio-group-context")
