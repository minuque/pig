import type { ThemePreset, ThemePresetId, ThemeSeed } from "./types.js"

export type OklchColor = Readonly<{ l: number; c: number; h: number }>

export const DERIVED_THEME_TOKENS = [
  "--bg",
  "--sidebar",
  "--bg-surface",
  "--bg-raised",
  "--fg",
  "--fg-secondary",
  "--fg-muted",
  "--fg-on-accent",
  "--accent-solid",
  "--accent-solid-hover",
  "--accent-text",
] as const

export type DerivedThemeToken = (typeof DERIVED_THEME_TOKENS)[number]

export const DEFAULT_THEME_PRESET_ID: ThemePresetId = "linear"
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "linear",
    light: { canvas: "#ffffff", accent: "#5e6ad2" },
    dark: { canvas: "#101012", accent: "#5e6ad2" },
  },
  {
    id: "paper",
    light: { canvas: "#fbf9f5", accent: "#b55d35" },
    dark: { canvas: "#141210", accent: "#d17a4f" },
  },
  {
    id: "ocean",
    light: { canvas: "#f8fafc", accent: "#2563eb" },
    dark: { canvas: "#0e131b", accent: "#4d8bf5" },
  },
  {
    id: "grove",
    light: { canvas: "#f8faf8", accent: "#247a57" },
    dark: { canvas: "#0f1412", accent: "#3da379" },
  },
  {
    id: "iris",
    light: { canvas: "#faf9fc", accent: "#6d4ad6" },
    dark: { canvas: "#121017", accent: "#896be6" },
  },
]

export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0]!
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const expanded = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean
  const int = Number.parseInt(expanded, 16)
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

export function hexToOklch(hex: string): OklchColor {
  const [sr, sg, sb] = hexToRgb(hex)
  const r = srgbToLinear(sr)
  const g = srgbToLinear(sg)
  const b = srgbToLinear(sb)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.hypot(A, B)
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { l: clamp01(L), c, h }
}

function oklchToLinearRgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180
  const A = c * Math.cos(rad)
  const B = c * Math.sin(rad)
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B
  const s_ = l - 0.0894841775 * A - 1.291485548 * B
  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

function inGamut([r, g, b]: [number, number, number]): boolean {
  const eps = 1e-6
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps
}

export function oklchToHex(color: OklchColor): string {
  const l = clamp01(color.l)

  if (l <= 1e-4) return "#000000"

  if (l >= 1 - 1e-4) return "#ffffff"

  const targetC = Math.max(0, color.c)
  let rgb = oklchToLinearRgb(l, targetC, color.h)

  if (!inGamut(rgb)) {
    let low = 0
    let high = targetC

    for (let step = 0; step < 16; step++) {
      const mid = (low + high) / 2

      if (inGamut(oklchToLinearRgb(l, mid, color.h))) low = mid
      else high = mid
    }

    rgb = oklchToLinearRgb(l, low, color.h)
  }

  return rgbToHex(linearToSrgb(rgb[0]), linearToSrgb(rgb[1]), linearToSrgb(rgb[2]))
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA)
  const lumB = relativeLuminance(hexB)
  const light = Math.max(lumA, lumB)
  const dark = Math.min(lumA, lumB)
  return (light + 0.05) / (dark + 0.05)
}

function tuneContrast(
  base: OklchColor,
  backgrounds: readonly string[],
  minRatio: number,
  direction: "darker" | "lighter",
): string {
  let l = base.l
  const step = direction === "darker" ? -0.006 : 0.006
  const limit = direction === "darker" ? 0.08 : 0.96

  for (let i = 0; i < 80; i++) {
    const candidate = oklchToHex({ l, c: base.c, h: base.h })

    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= minRatio)) return candidate

    if ((direction === "darker" && l <= limit) || (direction === "lighter" && l >= limit))
      return candidate
    l = clamp01(l + step)
  }

  return oklchToHex({ l, c: base.c, h: base.h })
}

export function deriveThemeTokens(
  seed: ThemeSeed,
  isDark: boolean,
): Record<DerivedThemeToken, string> {
  const canvas = hexToOklch(seed.canvas)
  const accent = hexToOklch(seed.accent)
  const bg = oklchToHex(canvas)
  const sidebar = isDark
    ? oklchToHex({ l: Math.max(0.11, canvas.l - 0.018), c: canvas.c, h: canvas.h })
    : oklchToHex({ l: canvas.l - 0.018, c: canvas.c, h: canvas.h })
  const bgSurface = isDark ? oklchToHex({ l: canvas.l + 0.032, c: canvas.c, h: canvas.h }) : sidebar
  const bgRaised = isDark
    ? oklchToHex({ l: canvas.l + 0.052, c: canvas.c, h: canvas.h })
    : canvas.l >= 0.995
      ? "#fbfbfc"
      : oklchToHex({ l: Math.min(1, canvas.l + 0.01), c: canvas.c * 0.5, h: canvas.h })
  const tintC = isDark ? Math.min(canvas.c, 0.008) : Math.min(canvas.c, 0.012)
  const dir = isDark ? "lighter" : "darker"
  const fg = tuneContrast({ l: isDark ? 0.935 : 0.285, c: tintC, h: canvas.h }, [bg], 12, dir)
  const fgSecondary = tuneContrast(
    { l: isDark ? 0.715 : 0.435, c: tintC, h: canvas.h },
    [bg],
    6.5,
    dir,
  )
  const fgMuted = tuneContrast({ l: isDark ? 0.615 : 0.535, c: tintC, h: canvas.h }, [bg], 4.6, dir)
  const accentSolid = isDark ? tuneContrast(accent, [bg], 4.5, "lighter") : oklchToHex(accent)
  const solidL = hexToOklch(accentSolid).l
  const accentSolidHover = oklchToHex({
    l: isDark ? Math.min(0.88, solidL + 0.055) : Math.max(0.24, solidL - 0.06),
    c: accent.c,
    h: accent.h,
  })
  const fgOnAccent =
    contrastRatio("#ffffff", accentSolid) >= 3.8 ||
    contrastRatio("#ffffff", accentSolid) >= contrastRatio("#101012", accentSolid)
      ? "#ffffff"
      : "#101012"
  const accentText = isDark
    ? tuneContrast(
        { l: Math.max(accent.l + 0.14, 0.75), c: Math.min(accent.c, 0.15), h: accent.h },
        [bg, bgSurface],
        5.2,
        "lighter",
      )
    : tuneContrast(
        { l: Math.min(accent.l, 0.5), c: accent.c, h: accent.h },
        [bg, bgSurface],
        4.6,
        "darker",
      )
  return {
    "--bg": bg,
    "--sidebar": sidebar,
    "--bg-surface": bgSurface,
    "--bg-raised": bgRaised,
    "--fg": fg,
    "--fg-secondary": fgSecondary,
    "--fg-muted": fgMuted,
    "--fg-on-accent": fgOnAccent,
    "--accent-solid": accentSolid,
    "--accent-solid-hover": accentSolidHover,
    "--accent-text": accentText,
  }
}
