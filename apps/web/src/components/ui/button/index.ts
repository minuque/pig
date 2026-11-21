import type { Size } from "@/types/ui-type.js"

export { default as Button } from "./Button.vue"

export { default as IconButton } from "./IconButton.vue"

/** 尺寸档跟基础件同一套：文字按钮 s=28、m=32、l=36，图标按钮 s=24、m=28、l=36。 */
export type ButtonSize = Size

export type ButtonVariant = "solid" | "secondary" | "outline" | "ghost"

/** 圆角档：不传时跟随主题，传入只影响这一个按钮 */
export type Radius = "none" | "small" | "medium" | "large" | "full"

/** 给不用 Button 组件、但要是同一种外观的元素（如 AlertDialog 的动作按钮）用 */
export function buttonAttrs(variant: ButtonVariant = "solid", size: ButtonSize = "m") {
  return {
    "data-button": "",
    "data-variant": variant,
    "data-size": size,
  }
}
