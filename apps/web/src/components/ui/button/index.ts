import type { Size } from "@components/ui/rt/size.js"

export { default as Button } from "./Button.vue"

export { default as IconButton } from "./IconButton.vue"

/** 尺寸档跟基础件同一套：s=24/28px、m=32px、l=40px。rt 的 48px 档不进这套刻度。 */
export type ButtonSize = Size

export type ButtonVariant = "solid" | "soft" | "surface" | "outline" | "ghost"

export type Radius = "none" | "small" | "medium" | "large" | "full"

export function buttonAttrs(variant: ButtonVariant = "solid", size: ButtonSize = "m") {
  return {
    "data-button": "",
    "data-variant": variant,
    "data-size": size,
  }
}
