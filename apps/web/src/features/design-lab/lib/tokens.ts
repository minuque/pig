import { nextTick, onMounted, ref, watch } from "vue"
import rtCss from "@style/rt.css?raw"
import tokensCss from "@style/tokens.css?raw"
import { useColorScheme } from "@features/theme/index.js"
import type { Label } from "@features/design-lab/lib/nav.js"

export type GroupId =
  | "color-brand"
  | "color-surface"
  | "color-text"
  | "color-interaction"
  | "color-state"
  | "color-code"
  | "color-mark"
  | "color"
  | "text"
  | "leading"
  | "font"
  | "space"
  | "radius"
  | "shadow"
  | "size"
  | "layout"
  | "layer"
  | "material"
  | "motion"
  | "other"

export type Token = { name: string; value: string }

export type Category = { id: string; title: Label; groups: GroupId[] }

/** 总览卡片的 9 类，每类收若干细分组；详情页按细分组分段。 */
export const CATEGORIES: Category[] = [
  {
    id: "colors",
    title: { zh: "颜色", en: "Colors" },
    groups: [
      "color-brand",
      "color-surface",
      "color-text",
      "color-interaction",
      "color-state",
      "color-code",
      "color-mark",
      "color",
    ],
  },
  {
    id: "typography",
    title: { zh: "字体排印", en: "Typography" },
    groups: ["text", "leading", "font"],
  },
  { id: "radius", title: { zh: "圆角", en: "Radius" }, groups: ["radius"] },
  { id: "shadows", title: { zh: "阴影与描边", en: "Shadows" }, groups: ["shadow"] },
  { id: "spacing", title: { zh: "间距", en: "Spacing" }, groups: ["space"] },
  { id: "motion", title: { zh: "动效", en: "Motion" }, groups: ["motion"] },
  { id: "sizes", title: { zh: "尺寸与布局", en: "Size & layout" }, groups: ["size", "layout"] },
  { id: "layers", title: { zh: "层级", en: "Layers" }, groups: ["layer"] },
  {
    id: "material",
    title: { zh: "透明度与其他", en: "Opacity & more" },
    groups: ["material", "other"],
  },
]
export const GROUP_TITLES: Record<GroupId, Label> = {
  "color-brand": { zh: "主题", en: "Brand" },
  "color-surface": { zh: "表面与边框", en: "Surface & border" },
  "color-text": { zh: "文字", en: "Text" },
  "color-interaction": { zh: "交互", en: "Interaction" },
  "color-state": { zh: "状态", en: "Status" },
  "color-code": { zh: "代码与图表", en: "Code & chart" },
  "color-mark": { zh: "插画与预览", en: "Illustration & preview" },
  color: { zh: "其他颜色", en: "Other colors" },
  text: { zh: "字号", en: "Font size" },
  leading: { zh: "行高与字距", en: "Line height & tracking" },
  font: { zh: "字体与字重", en: "Font & weight" },
  space: { zh: "间距", en: "Spacing" },
  radius: { zh: "圆角", en: "Radius" },
  shadow: { zh: "阴影与描边", en: "Shadow & stroke" },
  size: { zh: "尺寸", en: "Size" },
  layout: { zh: "布局", en: "Layout" },
  layer: { zh: "层级", en: "Layers" },
  material: { zh: "透明度与对比", en: "Opacity & contrast" },
  motion: { zh: "动效", en: "Motion" },
  other: { zh: "其他", en: "Other" },
}
const PREFIX: [RegExp, GroupId][] = [
  [/^--text-.*--/, "leading"],
  [/^--text-/, "text"],
  [/^--(default-)?font-/, "font"],
  [/^--spac(e|ing)/, "space"],
  [/radius/, "radius"],
  [/^--(shadow|divider|focus-ring)/, "shadow"],
  [/^--(size|line-icon|border-width|icon-button|startup-logo)/, "size"],
  [/^--(transcript|header|titlebar|edge-fade|corner)/, "layout"],
  [/^--z-/, "layer"],
  [/^--(opacity|contrast-boost)/, "material"],
  [/^--(duration|ease)/, "motion"],
]
// 颜色按用途细分，按顺序取第一个命中；都不中归「其他颜色」
const COLOR_PREFIX: [RegExp, GroupId][] = [
  [/^--(success|warning|danger|info|state-|scrim)/, "color-state"],
  [/^--(primary|link$)/, "color-brand"],
  [/^--(code|language|inline-code|mermaid)/, "color-code"],
  [/^--(mascot|theme-wire)/, "color-mark"],
  [/^--(btn|fill|scrollbar|effort|minimap|composer-inset)/, "color-interaction"],
  [/foreground|placeholder|^--contrast/, "color-text"],
  [/^--(background|card|surface|sidebar|popover|inverse|border|white)/, "color-surface"],
]
// 只收根作用域里的声明：.dark 是同名覆盖，不另列
const NAMES = [...new Set([...declared(tokensCss), ...declared(rtCss)])]

function declared(css: string): string[] {
  const blocks = css.match(/(?::root|\.radix-themes)\s*\{[^}]*\}/g) ?? []
  return blocks.flatMap((block) =>
    [...block.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]!),
  )
}

export function groupOf(token: Token): GroupId {
  const hit = PREFIX.find(([pattern]) => pattern.test(token.name))

  if (hit) return hit[1]

  if (!CSS.supports("color", token.value)) return "other"
  return COLOR_PREFIX.find(([pattern]) => pattern.test(token.name))?.[1] ?? "color"
}

/** 实时读取全部 token 的计算值，切换明暗后重读。 */
export function useTokens() {
  const { isDark } = useColorScheme()
  const tokens = ref<Token[]>([])

  function read() {
    const root = document.querySelector("[data-is-root-theme]") ?? document.documentElement
    const style = getComputedStyle(root)
    tokens.value = NAMES.map((name) => ({
      name,
      value: style.getPropertyValue(name).trim(),
    })).filter((token) => token.value !== "")
  }

  onMounted(read)
  watch(isDark, () => nextTick(read))
  return tokens
}
