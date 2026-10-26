/**
 * 可选的 accent 与它对应的中性色族。
 * 色值不在这里：每套 accent 的 12 阶与 alpha 由 style/palettes.css 从 Radix Colors 引入，
 * 切 accent 只改 html 的 data-accent-color（见 palette.ts）。
 * 数量从 14 收到 6：只留色相互相拉开且对比度稳定的几套，
 * 被删掉的 id 在读取时回落到默认 indigo。
 */
export type AccentId = "indigo" | "blue" | "teal" | "green" | "orange" | "red"

/** 中性色族：与 Radix Themes 的 accent → gray 对应关系一致 */
export type GrayFamily = "slate" | "sage" | "sand" | "mauve"

export type AccentDefinition = Readonly<{
  id: AccentId
  label: string
  gray: GrayFamily
}>

export const ACCENTS: ReadonlyArray<AccentDefinition> = [
  { id: "indigo", label: "Indigo", gray: "slate" },
  { id: "blue", label: "Blue", gray: "slate" },
  { id: "teal", label: "Teal", gray: "sage" },
  { id: "green", label: "Green", gray: "sage" },
  { id: "orange", label: "Orange", gray: "sand" },
  { id: "red", label: "Red", gray: "mauve" },
]
export const DEFAULT_ACCENT_ID: AccentId = "indigo"

export function isAccentId(value: string | null | undefined): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value)
}

const BY_ID = new Map(ACCENTS.map((accent) => [accent.id, accent]))

export function findAccent(id: AccentId): AccentDefinition {
  return BY_ID.get(id) ?? ACCENTS[0]!
}
