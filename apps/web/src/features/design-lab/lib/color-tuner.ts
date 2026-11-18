import { contrast, oklchToHex } from "@features/design-lab/lib/oklch.js"

/** 一套主题的亮度参数：主区、层差、浮层、三级文字，全是 OKLCH 的 L（0–1）。 */
export type Levels = {
  bg: number
  step: number
  raised: number
  fg: number
  secondary: number
  faint: number
}

export type Params = { hue: number; chroma: number; light: Levels; dark: Levels }

export type Scheme = Record<
  "bg" | "sunken" | "surface" | "raised" | "fg" | "secondary" | "faint",
  string
>

/** 起点：文字与 tokens.css 一致，表面是当前石墨底色在 OKLCH 里的近似（色相 285°，极低色度）。 */
export const DEFAULTS: Params = {
  hue: 285,
  chroma: 0.004,
  light: { bg: 0.972, step: 0.014, raised: 1, fg: 0.32, secondary: 0.48, faint: 0.545 },
  dark: { bg: 0.172, step: 0.017, raised: 0.215, fg: 0.86, secondary: 0.72, faint: 0.63 },
}

/** 侧栏比主区低一个层差，卡片高一个层差；文字色度取表面的两倍，冷色相读得出来但不发蓝。 */
export function scheme(params: Params, levels: Levels): Scheme {
  const surface = (l: number) => oklchToHex(l, params.chroma, params.hue)
  const text = (l: number) => oklchToHex(l, params.chroma * 2, params.hue)
  return {
    bg: surface(levels.bg),
    sunken: surface(levels.bg - levels.step),
    surface: surface(levels.bg + levels.step),
    raised: surface(levels.raised),
    fg: text(levels.fg),
    secondary: text(levels.secondary),
    faint: text(levels.faint),
  }
}

/** 预览容器上的变量：只覆盖这几个语义 token，其余照常从 tokens.css 继承。 */
export function previewVars(colors: Scheme): Record<string, string> {
  return {
    "--bg": colors.bg,
    "--bg-sunken": colors.sunken,
    "--bg-surface": colors.surface,
    "--bg-raised": colors.raised,
    "--fg": colors.fg,
    "--fg-secondary": colors.secondary,
    "--fg-faint": colors.faint,
  }
}

/** 三级文字分别压在主区、侧栏、卡片上的 WCAG 2 对比度。 */
export function ratios(colors: Scheme) {
  return (["fg", "secondary", "faint"] as const).map((key) => ({
    key,
    values: (["bg", "sunken", "surface"] as const).map((ground) =>
      contrast(colors[key], colors[ground]),
    ),
  }))
}

export function cssBlock(selector: string, colors: Scheme): string {
  return [
    `/* tokens.css → ${selector} */`,
    `--bg: ${colors.bg};`,
    `--bg-sunken: ${colors.sunken};`,
    `--bg-surface: ${colors.surface};`,
    `--bg-raised: ${colors.raised};`,
    `--fg: ${colors.fg};`,
    `--fg-secondary: ${colors.secondary};`,
    `--fg-faint: ${colors.faint};`,
  ].join("\n")
}
