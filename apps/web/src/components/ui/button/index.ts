export { default as Button } from "./Button.vue"

export { default as IconButton } from "./IconButton.vue"

/** Radix Themes 的按钮尺寸：1=24px、2=32px、3=40px、4=48px */
export type ButtonSize = "1" | "2" | "3" | "4"

export type ButtonVariant =
  "classic" | "solid" | "soft" | "surface" | "outline" | "ghost" | "ghost-offset"

/** 圆角档：不传时跟随主题，传入只影响这一个按钮 */
export type Radius = "none" | "small" | "medium" | "large" | "full"

export type HighContrast = boolean

/** 拼一组 rt 按钮类：给不用 Button 组件、但要是同一种外观的元素（如 AlertDialog 的动作按钮）。 */
export function rtButtonClass(variant: ButtonVariant = "solid", size: ButtonSize = "2"): string {
  return `rt-reset rt-BaseButton rt-Button rt-r-size-${size} rt-variant-${variant}`
}
