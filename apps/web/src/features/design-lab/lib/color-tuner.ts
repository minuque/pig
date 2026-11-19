import { contrast, oklchToHex } from "@features/design-lab/lib/oklch.js"

/** 一套主题的亮度参数：主区、侧栏、卡片、浮层、两级文字，全是 OKLCH 的 L（0–1）。 */
export type Levels = {
  bg: number
  sidebar: number
  surface: number
  raised: number
  fg: number
  secondary: number
}

export type Params = { hue: number; chroma: number; light: Levels; dark: Levels }

export type Scheme = Record<"bg" | "sidebar" | "surface" | "raised" | "fg" | "secondary", string>

/** 起点：tokens.css 当前取值（色相 285°，色度 0.005）。文字 token 是 black / white alpha，
    这里取它们压在主区上的等效实色，方便按表面亮度调档。 */
export const DEFAULTS: Params = {
  hue: 285,
  chroma: 0.005,
  light: { bg: 1, sidebar: 0.976, surface: 0.976, raised: 0.988, fg: 0.321, secondary: 0.51 },
  dark: { bg: 0.174, sidebar: 0.159, surface: 0.205, raised: 0.226, fg: 0.928, secondary: 0.703 },
}

/** 每层各自取亮度：浅色各层都在白底上往下压，深色除侧栏外都比主区亮一档。 */
export function scheme(params: Params, levels: Levels): Scheme {
  const surface = (l: number) => oklchToHex(l, params.chroma, params.hue)
  const text = (l: number) => oklchToHex(l, params.chroma * 2, params.hue)
  return {
    bg: surface(levels.bg),
    sidebar: surface(levels.sidebar),
    surface: surface(levels.surface),
    raised: surface(levels.raised),
    fg: text(levels.fg),
    secondary: text(levels.secondary),
  }
}

/** 预览容器上的变量：只覆盖这几个语义 token，其余照常从 tokens.css 继承。 */
export function previewVars(colors: Scheme): Record<string, string> {
  return {
    "--bg": colors.bg,
    "--sidebar": colors.sidebar,
    "--bg-surface": colors.surface,
    "--bg-raised": colors.raised,
    "--fg": colors.fg,
    "--fg-secondary": colors.secondary,
  }
}

/** 两级文字分别压在主区、侧栏、卡片上的 WCAG 2 对比度。 */
export function ratios(colors: Scheme) {
  return (["fg", "secondary"] as const).map((key) => ({
    key,
    values: (["bg", "sidebar", "surface"] as const).map((ground) =>
      contrast(colors[key], colors[ground]),
    ),
  }))
}

export function cssBlock(selector: string, colors: Scheme): string {
  return [
    `/* tokens.css → ${selector} */`,
    `--bg: ${colors.bg};`,
    `--sidebar: ${colors.sidebar};`,
    `--bg-surface: ${colors.surface};`,
    `--bg-raised: ${colors.raised};`,
    `--fg: ${colors.fg};`,
    `--fg-secondary: ${colors.secondary};`,
  ].join("\n")
}
