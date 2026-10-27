import type { ComputedRef, InjectionKey } from "vue"
import type { Size } from "@components/ui/rt/size.js"

/** 单选组的跨文件契约。注入键与类型同源，一起放这里，不再单开 context.ts。 */
export interface RadioGroupContext {
  size: Size
  variant: "classic" | "surface" | "soft"
}

/** 单选组把尺寸与变体传给它下面的 Radio：rt 的外观类要落在 Radio 自己身上。 */
export const RADIO_GROUP_KEY: InjectionKey<ComputedRef<RadioGroupContext>> =
  Symbol("radio-group-context")
