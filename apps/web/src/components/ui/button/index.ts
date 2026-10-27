import { sizeClass, type Size } from "@components/ui/rt/size.js"

export { default as Button } from "./Button.vue"

export { default as IconButton } from "./IconButton.vue"

/** 尺寸档跟基础件同一套：s=24/28px、m=32px、l=40px。rt 的 48px 档不进这套刻度。 */
export type ButtonSize = Size

export type ButtonVariant = "classic" | "solid" | "soft" | "surface" | "outline" | "ghost"

/** 圆角档：不传时跟随主题，传入只影响这一个按钮 */
export type Radius = "none" | "small" | "medium" | "large" | "full"

export type HighContrast = boolean

/** 拼一组 rt 按钮类：给不用 Button 组件、但要是同一种外观的元素（如 AlertDialog 的动作按钮）。 */
export function rtButtonClass(variant: ButtonVariant = "solid", size: ButtonSize = "m"): string {
  return `rt-reset rt-BaseButton rt-Button ${sizeClass(size)} rt-variant-${variant}`
}
