/** 主题能换的颜色。派生色（hover、halo、下划线）从这些色算出，不进名单。 */

export const THEME_ROLES = [
  "primary",
  "primary-active",
  "primary-foreground",
  "background",
  "card",
  "sidebar",
  "composer-background",
  "composer-border",
  "user-prompt-background",
  "popover",
  "foreground",
  "foreground-secondary",
  "foreground-muted",
  "foreground-faint",
  "link",
  "border",
  "border-subtle",
  "composer-ring",
  "interaction-hover",
  "interaction-selected",
  "hairline",
  "card-border",
  "media-outline",
  "scrollbar-color",
  "scrim",
  "success",
  "warning",
  "destructive",
  "success-bg",
  "info-bg",
  "warning-bg",
  "destructive-bg",
  "success-foreground",
  "warning-foreground",
  "destructive-foreground",
  "inverse-background",
  "inverse-background-hover",
  "inverse-foreground",
  "accent-skill",
  "accent-steel",
  "accent-teal",
  "accent-gray",
  "star",
  "mermaid-bg",
  "mermaid-fill",
  "mermaid-line",
  "sidebar-foreground",
  "sidebar-hover",
  "sidebar-selected",
  "sidebar-border",
  "toolbar-background",
  "toolbar-foreground",
  "code-background",
  "code-foreground",
] as const

export type ThemeRole = (typeof THEME_ROLES)[number]

export type ThemeColors = Readonly<Record<ThemeRole, string>>

/** 主题只需写的颜色。其余角色由 fillTheme 从这些色算出。 */
export const THEME_SEEDS = [
  "background",
  "card",
  "primary",
  "foreground",
  "sidebar",
  "success",
  "warning",
  "destructive",
] as const

export type ThemeSeed = (typeof THEME_SEEDS)[number]

export type ThemeSeedColors = Readonly<Record<ThemeSeed, string>>

const channel = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0")

/** 解析 #rrggbb。其余写法不参与混色。 */
function channels(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  const hex = match?.[1]

  if (!hex) return null
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** 把 base 向 toward 推 amount。任一个不是 #rrggbb 时保持 base。 */
function mix(base: string, toward: string, amount: number): string {
  const from = channels(base)
  const to = channels(toward)

  if (!from || !to) return base
  return `#${from.map((value, index) => channel(value + ((to[index] ?? value) - value) * amount)).join("")}`
}

/** 用种子色补齐一套主题。overrides 覆盖同名角色，手调的默认主题靠它保持原值。 */
export function fillTheme(
  mode: "light" | "dark",
  seed: ThemeSeedColors,
  overrides: Partial<ThemeColors> = {},
): ThemeColors {
  const dark = mode === "dark"
  const { background, card, primary, foreground, sidebar, success, warning, destructive } = seed
  const hover = mix(background, foreground, dark ? 0.14 : 0.07)
  const border = mix(background, foreground, dark ? 0.22 : 0.16)
  const derived: ThemeColors = {
    ...seed,
    "primary-active": mix(primary, dark ? "#ffffff" : "#000000", 0.16),
    "primary-foreground": dark ? "#000000" : "#ffffff",
    "sidebar-foreground": foreground,
    "sidebar-hover": mix(sidebar, foreground, dark ? 0.1 : 0.06),
    "sidebar-selected": mix(sidebar, primary, dark ? 0.22 : 0.14),
    "sidebar-border": mix(background, foreground, dark ? 0.16 : 0.1),
    "toolbar-background": card,
    "toolbar-foreground": foreground,
    "code-background": mix(card, foreground, dark ? 0.05 : 0.04),
    "code-foreground": foreground,
    "composer-background": mix(background, foreground, dark ? 0.18 : 0.05),
    "composer-border": `rgb(from ${foreground} r g b / 0.08)`,
    "user-prompt-background": mix(background, foreground, dark ? 0.16 : 0.08),
    popover: card,
    "foreground-secondary": mix(foreground, background, 0.28),
    "foreground-muted": mix(foreground, background, 0.42),
    "foreground-faint": mix(foreground, background, 0.58),
    link: primary,
    border,
    "border-subtle": mix(background, foreground, dark ? 0.16 : 0.1),
    "composer-ring": `rgb(from ${foreground} r g b / ${dark ? 0.2 : 0.16})`,
    "interaction-hover": hover,
    "interaction-selected": mix(background, foreground, dark ? 0.2 : 0.1),
    hairline: `rgb(from ${foreground} r g b / ${dark ? 0.16 : 0.12})`,
    "card-border": `rgb(from ${foreground} r g b / 0.1)`,
    "media-outline": `rgb(from ${foreground} r g b / 0.1)`,
    "scrollbar-color": mix(background, foreground, dark ? 0.12 : 0.14),
    scrim: `rgba(0, 0, 0, ${dark ? 0.55 : 0.4})`,
    "success-bg": mix(background, success, dark ? 0.2 : 0.16),
    "info-bg": mix(background, primary, dark ? 0.2 : 0.12),
    "warning-bg": mix(background, warning, dark ? 0.2 : 0.16),
    "destructive-bg": mix(background, destructive, dark ? 0.2 : 0.14),
    "success-foreground": dark ? "#000000" : "#ffffff",
    "warning-foreground": dark ? "#000000" : "#ffffff",
    "destructive-foreground": dark ? "#000000" : "#ffffff",
    "inverse-background": foreground,
    "inverse-background-hover": mix(foreground, background, 0.12),
    "inverse-foreground": background,
    "accent-skill": mix(primary, dark ? "#ffffff" : "#000000", 0.3),
    "accent-steel": mix(foreground, background, 0.42),
    "accent-teal": success,
    "accent-gray": mix(foreground, background, 0.58),
    star: warning,
    "mermaid-bg": card,
    "mermaid-fill": background,
    "mermaid-line": border,
  }
  return { ...derived, ...overrides }
}

/** 角色注入到 html 上的变量名。装了主题时语义层改读这些变量。 */
export function themeVar(role: ThemeRole): string {
  return `--app-theme-${role}`
}

export interface ThemeTarget {
  setProperty(name: string, value: string): void
  removeProperty(name: string): void
  setThemeId(id: string | null): void
  store(json: string | null): void
}

/** 把一套主题画到目标上。colors 为 null 时清除，回到默认色。 */
export function paintTheme(
  target: ThemeTarget,
  id: string | null,
  colors: ThemeColors | null,
): void {
  if (!id || !colors) {
    target.setThemeId(null)

    for (const role of THEME_ROLES) target.removeProperty(themeVar(role))
    target.store(null)
    return
  }

  target.setThemeId(id)

  for (const role of THEME_ROLES) target.setProperty(themeVar(role), colors[role])
  target.store(JSON.stringify({ id, colors }))
}

/** 默认主题的 id。选它时清除注入，颜色回到 :root / .dark，不另存一份。 */
export const DEFAULT_THEME_ID = "pig"

export type ThemePreview = Readonly<{
  sidebar: string
  surface: string
  canvas: string
  accent: string
  messageSurface: string
  messageAction: string
}>

export type ThemeDefinition = Readonly<{
  id: string
  label: string
  light: ThemeColors
  dark: ThemeColors
  lightPreview: ThemePreview
  darkPreview: ThemePreview
}>

/** 用两份种子色组一个主题。浅色和深色各自生成，互不借用。 */
function theme(
  id: string,
  label: string,
  light: ThemeSeedColors,
  dark: ThemeSeedColors,
): ThemeDefinition {
  const lightColors = fillTheme("light", light)
  const darkColors = fillTheme("dark", dark)
  return {
    id,
    label,
    light: lightColors,
    dark: darkColors,
    lightPreview: {
      sidebar: lightColors.sidebar,
      surface: lightColors.card,
      canvas: lightColors.background,
      accent: lightColors.primary,
      messageSurface: lightColors["user-prompt-background"],
      messageAction: lightColors.primary,
    },
    darkPreview: {
      sidebar: darkColors.sidebar,
      surface: darkColors.card,
      canvas: darkColors.background,
      accent: darkColors.primary,
      messageSurface: darkColors["user-prompt-background"],
      messageAction: darkColors.primary,
    },
  }
}

/** 默认主题：色值与 :root / .dark 一致，只给主题卡画预览。选它时不注入。 */
export const DEFAULT_THEME: ThemeDefinition = {
  id: DEFAULT_THEME_ID,
  label: "pig",
  light: {
    primary: "#5e6ad2",
    "primary-active": "#4f5bc4",
    "primary-foreground": "#ffffff",
    background: "#f7f7f8",
    card: "#ffffff",
    sidebar: "#f7f7f8",
    "composer-background": "#f4f4f5",
    "composer-border": "rgb(0 0 0 / 0.08)",
    "user-prompt-background": "#e8e8ea",
    popover: "#ffffff",
    foreground: "#1b1b1b",
    "foreground-secondary": "#5c5c5c",
    "foreground-muted": "#6e6e6e",
    "foreground-faint": "#8a8a8a",
    link: "#4c56c8",
    border: "#dedede",
    "border-subtle": "#e8e8e8",
    "composer-ring": "rgb(0 0 0 / 0.16)",
    "interaction-hover": "#e8e8eb",
    "interaction-selected": "#e6e6e8",
    hairline: "hsl(0 0% 0% / 0.12)",
    "card-border": "hsl(210 18% 32% / 0.1)",
    "media-outline": "rgba(0, 0, 0, 0.1)",
    "scrollbar-color": "#dad8d8",
    scrim: "rgba(0, 0, 0, 0.4)",
    success: "#52a450",
    warning: "#d97706",
    destructive: "#c94446",
    "success-bg": "#dcfce7",
    "info-bg": "#eceef8",
    "warning-bg": "#fef3e2",
    "destructive-bg": "#fee2e2",
    "success-foreground": "var(--primary-foreground)",
    "warning-foreground": "var(--primary-foreground)",
    "destructive-foreground": "var(--primary-foreground)",
    "inverse-background": "#1b1b1b",
    "inverse-background-hover": "#262626",
    "inverse-foreground": "#ffffff",
    "accent-skill": "#8160d8",
    "accent-steel": "#5b7c9d",
    "accent-teal": "#2f8f7b",
    "accent-gray": "#8a8d94",
    star: "#fbbf24",
    "mermaid-bg": "#ffffff",
    "mermaid-fill": "#eaeef2",
    "mermaid-line": "#d4d4d4",
    "sidebar-foreground": "#1b1b1b",
    "sidebar-hover": "#e8e8eb",
    "sidebar-selected": "#e6e6e8",
    "sidebar-border": "#e8e8e8",
    "toolbar-background": "#ffffff",
    "toolbar-foreground": "#1b1b1b",
    "code-background": "#f6f6f6",
    "code-foreground": "#1b1b1b",
  },
  dark: {
    primary: "#606acc",
    "primary-active": "#555fbf",
    "primary-foreground": "#ffffff",
    background: "#121214",
    card: "#0f0f11",
    sidebar: "#121214",
    "composer-background": "#27272a",
    "composer-border": "rgb(255 255 255 / 0.08)",
    "user-prompt-background": "#262628",
    popover: "#1c1c1f",
    foreground: "#e3e4e6",
    "foreground-secondary": "#b8b9bc",
    "foreground-muted": "#9a9b9e",
    "foreground-faint": "#7e7f83",
    link: "#9aa3ea",
    border: "#2a2a2e",
    "border-subtle": "#28282a",
    "composer-ring": "rgb(255 255 255 / 0.2)",
    "interaction-hover": "#26262b",
    "interaction-selected": "#2c2c31",
    hairline: "hsl(0 0% 100% / 0.16)",
    "card-border": "hsl(210 18% 78% / 0.09)",
    "media-outline": "rgba(255, 255, 255, 0.1)",
    "scrollbar-color": "#3a3a40",
    scrim: "rgba(0, 0, 0, 0.55)",
    success: "#69c967",
    warning: "#f5b44a",
    destructive: "#ff7e78",
    "success-bg": "#142c1e",
    "info-bg": "#1a1c33",
    "warning-bg": "#3a2a12",
    "destructive-bg": "#38191b",
    "success-foreground": "#000000",
    "warning-foreground": "#000000",
    "destructive-foreground": "#000000",
    "inverse-background": "#fafafa",
    "inverse-background-hover": "#ffffff",
    "inverse-foreground": "#171717",
    "accent-skill": "#c2a1ff",
    "accent-steel": "#8aa4c2",
    "accent-teal": "#5ec4ae",
    "accent-gray": "#9a9da4",
    star: "#f5b44a",
    "mermaid-bg": "#161618",
    "mermaid-fill": "#1a1a22",
    "mermaid-line": "#333338",
    "sidebar-foreground": "#e3e4e6",
    "sidebar-hover": "#26262b",
    "sidebar-selected": "#2c2c31",
    "sidebar-border": "#28282a",
    "toolbar-background": "#0f0f11",
    "toolbar-foreground": "#e3e4e6",
    "code-background": "#1a1a1c",
    "code-foreground": "#e3e4e6",
  },
  lightPreview: {
    sidebar: "#f7f7f8",
    surface: "#ffffff",
    canvas: "#f7f7f8",
    accent: "#5e6ad2",
    messageSurface: "#e8e8ea",
    messageAction: "#5e6ad2",
  },
  darkPreview: {
    sidebar: "#121214",
    surface: "#0f0f11",
    canvas: "#121214",
    accent: "#606acc",
    messageSurface: "#262628",
    messageAction: "#606acc",
  },
}
/** GitHub 主题：壳层走 GitHub 灰阶，强调色用 GitHub 蓝。 */
export const THEMES: ReadonlyArray<ThemeDefinition> = [
  DEFAULT_THEME,
  theme(
    "github",
    "GitHub",
    {
      background: "#ffffff",
      card: "#f6f8fa",
      primary: "#0969da",
      foreground: "#1f2328",
      sidebar: "#f6f8fa",
      success: "#1a7f37",
      warning: "#9a6700",
      destructive: "#d1242f",
    },
    {
      background: "#0d1117",
      card: "#010409",
      primary: "#4493f8",
      foreground: "#f0f6fc",
      sidebar: "#010409",
      success: "#3fb950",
      warning: "#d29922",
      destructive: "#f85149",
    },
  ),
  theme(
    "dracula",
    "Dracula",
    {
      background: "#f8f6fb",
      card: "#ffffff",
      primary: "#7c3aed",
      foreground: "#2b2340",
      sidebar: "#f3f0f8",
      success: "#16a34a",
      warning: "#ca8a04",
      destructive: "#dc2626",
    },
    {
      background: "#282a36",
      card: "#21222c",
      primary: "#bd93f9",
      foreground: "#f8f8f2",
      sidebar: "#21222c",
      success: "#50fa7b",
      warning: "#f1fa8c",
      destructive: "#ff5555",
    },
  ),
]
