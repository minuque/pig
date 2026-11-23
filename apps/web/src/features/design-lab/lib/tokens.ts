import { nextTick, onMounted, ref, watch } from "vue"
import tokensCss from "@style/tokens.css?raw"
import { useColorScheme } from "@features/theme/index.js"
import type { Label } from "@features/design-lab/lib/nav.js"

export type Layer = "primitive" | "semantic" | "component"

export type Token = { name: string; value: string; layer: Layer; group: string }

export type Kind =
  | "fill"
  | "fg"
  | "border"
  | "paint"
  | "text"
  | "leading"
  | "tracking"
  | "font"
  | "space"
  | "radius"
  | "shadow"
  | "size"
  | "width"
  | "opacity"
  | "ease"
  | "layer"
  | "none"

export type Category = { id: string; title: Label; match: (token: Token) => boolean }

const COLOR_GROUPS = new Set(["表面", "前景", "边与分割", "交互", "状态"])
const inGroups =
  (...groups: string[]) =>
  (token: Token) =>
    token.layer === "semantic" && groups.includes(token.group)
export const CATEGORIES: Category[] = [
  {
    id: "colors",
    title: { zh: "颜色", en: "Colors" },
    match: (token) =>
      token.layer === "primitive" || (token.layer === "semantic" && COLOR_GROUPS.has(token.group)),
  },
  { id: "typography", title: { zh: "字体排印", en: "Typography" }, match: inGroups("字") },
  { id: "radius", title: { zh: "圆角", en: "Radius" }, match: inGroups("圆角") },
  { id: "shadows", title: { zh: "阴影", en: "Shadows" }, match: inGroups("阴影") },
  { id: "spacing", title: { zh: "间距", en: "Spacing" }, match: inGroups("间距") },
  { id: "motion", title: { zh: "动效", en: "Motion" }, match: inGroups("动效") },
  {
    id: "sizes",
    title: { zh: "尺寸与布局", en: "Size & layout" },
    match: inGroups("图标与控件高", "布局"),
  },
  { id: "layers", title: { zh: "层级", en: "Layers" }, match: inGroups("层级") },
  {
    id: "components",
    title: { zh: "组件层", en: "Components" },
    match: (token) => token.layer === "component",
  },
]
const GROUP_EN: Record<string, string> = {
  原色阶: "Primitives",
  表面: "Surface",
  前景: "Foreground",
  边与分割: "Border & separator",
  交互: "Interaction",
  状态: "Status",
  字: "Type",
  间距: "Spacing",
  圆角: "Radius",
  阴影: "Shadow",
  动效: "Motion",
  图标与控件高: "Icon & control height",
  布局: "Layout",
  层级: "Layers",
}

export function groupTitle(group: string): Label {
  return { zh: group, en: GROUP_EN[group] ?? group }
}

const KNOB = /^--(base-|card-|table-|radius-\d+$|space-\d+$|focus-\d+$|default-|dialog-content)/
const PLACES = placed(tokensCss)

function placed(css: string): Omit<Token, "value">[] {
  const blocks = css.match(/:root\s*\{[^}]*\}/g) ?? []
  const seen = new Map<string, Omit<Token, "value">>()

  for (const block of blocks) {
    let layer: Layer = "semantic"
    let group = ""

    for (const line of block.split("\n")) {
      const header = /\/\*\s*(=+|-+)\s*([^：:-]+?)[：:\s-]/.exec(line)
      const name = /^\s*(--[\w-]+)\s*:/.exec(line)?.[1]

      if (header?.[1]!.startsWith("=")) {
        const title = header[2]!.trim()
        layer = title === "原色阶" ? "primitive" : title === "组件层" ? "component" : "semantic"
        group = layer === "primitive" ? "原色阶" : group
      } else if (header) group = header[2]!.trim()
      else if (name && !KNOB.test(name) && !seen.has(name)) {
        const prefix = name.split("-")[2] ?? name
        seen.set(name, { name, layer, group: layer === "component" ? prefix : group })
      }
    }
  }

  return [...seen.values()]
}

const LENGTH = /^-?[\d.]+(px|rem|em|%|ch|vh|vw)$/

export function kindOf(token: Token): Kind {
  const { name, value } = token

  if (/line-height$|--text-[a-z]+-line$/.test(name)) return "leading"

  if (name.endsWith("--letter-spacing")) return "tracking"

  if (/^--text-[a-z]+$/.test(name)) return "text"

  if (name.startsWith("--font-")) return "font"

  if (name === "--spacing" || name.startsWith("--space-")) return "space"

  if (name.startsWith("--radius-")) return "radius"

  if (/shadow|separator|focus-ring/.test(name)) return "shadow"

  if (/^--(border-width|icon-stroke)$/.test(name)) return "width"

  if (/^--(icon|control)-/.test(name)) return "size"

  if (/opacity/.test(name)) return "opacity"

  if (name.startsWith("--z-")) return "layer"

  if (/^cubic-bezier/.test(value)) return "ease"

  if (/gradient\(|url\(/.test(value)) return "paint"

  if (LENGTH.test(value)) return "size"

  if (/^--(fg|link)/.test(name) || /-text$/.test(name)) return "fg"

  if (/^--border/.test(name)) return "border"
  return CSS.supports("color", value) ? "fill" : "none"
}

export function useTokens() {
  const { isDark, presetId } = useColorScheme()
  const tokens = ref<Token[]>([])

  function read() {
    const style = getComputedStyle(document.documentElement)
    tokens.value = PLACES.map((place) => ({
      ...place,
      value: style.getPropertyValue(place.name).trim(),
    })).filter((token) => token.value !== "")
  }

  onMounted(read)
  watch([isDark, presetId], () => nextTick(read))
  return tokens
}
