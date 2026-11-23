import type { Size } from "@/types/ui-type.js"

export { default as Button } from "./Button.vue"

export { default as IconButton } from "./IconButton.vue"

export type ButtonSize = Size

export type ButtonVariant = "solid" | "secondary" | "outline" | "ghost"

export function buttonAttrs(variant: ButtonVariant = "solid", size: ButtonSize = "m") {
  return {
    "data-button": "",
    "data-variant": variant,
    "data-size": size,
  }
}
