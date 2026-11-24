import type { ComputedRef, InjectionKey } from "vue"
import type { Size } from "../../core/types.js"

export interface RadioGroupContext {
  size: Size
  variant: "surface" | "soft"
  color: string | undefined
}

export const RADIO_GROUP_KEY: InjectionKey<ComputedRef<RadioGroupContext>> =
  Symbol("radio-group-context")
