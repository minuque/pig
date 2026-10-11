/** 主题能换的颜色。派生色（hover、halo、下划线）从这些色算出，不进名单。 */

export const THEME_ROLES = [
  "primary",
  "primary-active",
  "on-primary",
  "canvas",
  "surface",
  "sidebar",
  "composer-bg",
  "composer-border",
  "user-prompt-bg",
  "popover",
  "ink",
  "ink-secondary",
  "ink-muted",
  "ink-faint",
  "link",
  "border",
  "border-subtle",
  "composer-ring",
  "interaction-hover",
  "interaction-selected",
  "hairline",
  "surface-border",
  "media-outline",
  "scrollbar-color",
  "scrollbar-hover",
  "scrim",
  "success",
  "warning",
  "danger",
  "success-bg",
  "info-bg",
  "warning-bg",
  "danger-bg",
  "success-foreground",
  "warning-foreground",
  "danger-foreground",
  "inverse-bg",
  "inverse-bg-hover",
  "inverse-fg",
  "accent-skill",
  "accent-steel",
  "accent-teal",
  "accent-gray",
  "star",
  "mermaid-bg",
  "mermaid-fill",
  "mermaid-line",
] as const

export type ThemeRole = (typeof THEME_ROLES)[number]

export type ThemeColors = Readonly<Record<ThemeRole, string>>

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

/** 主题预览用的少量颜色，只显示 shell 和几个面，不覆盖全部角色。 */
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

/** 默认主题：与 :root / .dark 的真值一致，主题卡用它画预览。 */
export const DEFAULT_THEME: ThemeDefinition = {
  id: "pig",
  label: "pig",
  light: {
    primary: "#5e6ad2",
    "primary-active": "#4f5bc4",
    "on-primary": "#ffffff",
    canvas: "#f7f7f8",
    surface: "#ffffff",
    sidebar: "#fcfcfd",
    "composer-bg": "#f4f4f5",
    "composer-border": "rgb(0 0 0 / 0.06)",
    "user-prompt-bg": "#e8e8ea",
    popover: "#ffffff",
    ink: "#1b1b1b",
    "ink-secondary": "#5c5c5c",
    "ink-muted": "#6e6e6e",
    "ink-faint": "#8a8a8a",
    link: "#4c56c8",
    border: "#dedede",
    "border-subtle": "#e8e8e8",
    "composer-ring": "rgb(0 0 0 / 0.16)",
    "interaction-hover": "#e8e8eb",
    "interaction-selected": "#e6e6e8",
    hairline: "hsl(0 0% 0% / 0.12)",
    "surface-border": "hsl(210 18% 32% / 0.1)",
    "media-outline": "rgba(0, 0, 0, 0.1)",
    "scrollbar-color": "#dad8d8",
    "scrollbar-hover": "#6b6b6b",
    scrim: "rgba(0, 0, 0, 0.4)",
    success: "#52a450",
    warning: "#d97706",
    danger: "#c94446",
    "success-bg": "#dcfce7",
    "info-bg": "#eceef8",
    "warning-bg": "#fef3e2",
    "danger-bg": "#fee2e2",
    "success-foreground": "#ffffff",
    "warning-foreground": "#ffffff",
    "danger-foreground": "#ffffff",
    "inverse-bg": "#1b1b1b",
    "inverse-bg-hover": "#262626",
    "inverse-fg": "#ffffff",
    "accent-skill": "#8160d8",
    "accent-steel": "#5b7c9d",
    "accent-teal": "#2f8f7b",
    "accent-gray": "#8a8d94",
    star: "#fbbf24",
    "mermaid-bg": "#ffffff",
    "mermaid-fill": "#eaeef2",
    "mermaid-line": "#d4d4d4",
  },
  dark: {
    primary: "#606acc",
    "primary-active": "#555fbf",
    "on-primary": "#ffffff",
    canvas: "#121214",
    surface: "#0f0f11",
    sidebar: "#161618",
    "composer-bg": "#27272a",
    "composer-border": "rgb(255 255 255 / 0.06)",
    "user-prompt-bg": "#262628",
    popover: "#1c1c1f",
    ink: "#e3e4e6",
    "ink-secondary": "#b8b9bc",
    "ink-muted": "#9a9b9e",
    "ink-faint": "#7e7f83",
    link: "#9aa3ea",
    border: "#2a2a2e",
    "border-subtle": "#28282a",
    "composer-ring": "rgb(255 255 255 / 0.2)",
    "interaction-hover": "#26262b",
    "interaction-selected": "#2c2c31",
    hairline: "hsl(0 0% 100% / 0.16)",
    "surface-border": "hsl(210 18% 78% / 0.09)",
    "media-outline": "rgba(255, 255, 255, 0.1)",
    "scrollbar-color": "#1c1c21",
    "scrollbar-hover": "#a3a3a3",
    scrim: "rgba(0, 0, 0, 0.55)",
    success: "#69c967",
    warning: "#f5b44a",
    danger: "#ff7e78",
    "success-bg": "#142c1e",
    "info-bg": "#1a1c33",
    "warning-bg": "#3a2a12",
    "danger-bg": "#38191b",
    "success-foreground": "#000000",
    "warning-foreground": "#000000",
    "danger-foreground": "#000000",
    "inverse-bg": "#fafafa",
    "inverse-bg-hover": "#ffffff",
    "inverse-fg": "#171717",
    "accent-skill": "#c2a1ff",
    "accent-steel": "#8aa4c2",
    "accent-teal": "#5ec4ae",
    "accent-gray": "#9a9da4",
    star: "#f5b44a",
    "mermaid-bg": "#161618",
    "mermaid-fill": "#1a1a22",
    "mermaid-line": "#333338",
  },
  lightPreview: {
    sidebar: "#fcfcfd",
    surface: "#ffffff",
    canvas: "#f7f7f8",
    accent: "#5e6ad2",
    messageSurface: "#e8e8ea",
    messageAction: "#5e6ad2",
  },
  darkPreview: {
    sidebar: "#161618",
    surface: "#0f0f11",
    canvas: "#121214",
    accent: "#606acc",
    messageSurface: "#262628",
    messageAction: "#606acc",
  },
}
/** 首个额外主题：暖灰壳层 + 砖红强调，验证注入层跑通。 */
export const THEMES: ReadonlyArray<ThemeDefinition> = [
  DEFAULT_THEME,
  {
    id: "grove",
    label: "Grove",
    light: {
      primary: "#8a4a2f",
      "primary-active": "#7a3f28",
      "on-primary": "#ffffff",
      canvas: "#f7f5f3",
      surface: "#fdfcfb",
      sidebar: "#faf8f6",
      "composer-bg": "#f1ece8",
      "composer-border": "rgb(0 0 0 / 0.06)",
      "user-prompt-bg": "#e9e2dc",
      popover: "#fdfcfb",
      ink: "#2a2320",
      "ink-secondary": "#6d6058",
      "ink-muted": "#8a7d72",
      "ink-faint": "#a89d92",
      link: "#8a4a2f",
      border: "#d9d0c7",
      "border-subtle": "#e9e2dc",
      "composer-ring": "rgb(0 0 0 / 0.16)",
      "interaction-hover": "#eae3de",
      "interaction-selected": "#e3d8d0",
      hairline: "hsl(20 15% 20% / 0.12)",
      "surface-border": "hsl(20 15% 25% / 0.1)",
      "media-outline": "rgba(0, 0, 0, 0.1)",
      "scrollbar-color": "#d8d0c7",
      "scrollbar-hover": "#7a6d63",
      scrim: "rgba(0, 0, 0, 0.4)",
      success: "#4a7c3f",
      warning: "#b45309",
      danger: "#b91c1c",
      "success-bg": "#e8f4e0",
      "info-bg": "#eceef8",
      "warning-bg": "#fef3e2",
      "danger-bg": "#fee2e2",
      "success-foreground": "#ffffff",
      "warning-foreground": "#ffffff",
      "danger-foreground": "#ffffff",
      "inverse-bg": "#2a2320",
      "inverse-bg-hover": "#3a322e",
      "inverse-fg": "#fdfcfb",
      "accent-skill": "#8160d8",
      "accent-steel": "#5b7c9d",
      "accent-teal": "#2f8f7b",
      "accent-gray": "#8a8d94",
      star: "#fbbf24",
      "mermaid-bg": "#fdfcfb",
      "mermaid-fill": "#f1ece8",
      "mermaid-line": "#d9d0c7",
    },
    dark: {
      primary: "#c2704d",
      "primary-active": "#a85f3f",
      "on-primary": "#1f1a17",
      canvas: "#161413",
      surface: "#121110",
      sidebar: "#1a1817",
      "composer-bg": "#262220",
      "composer-border": "rgb(255 255 255 / 0.08)",
      "user-prompt-bg": "#2a2623",
      popover: "#211e1c",
      ink: "#e8e2dd",
      "ink-secondary": "#bdb4ac",
      "ink-muted": "#a29990",
      "ink-faint": "#8a827a",
      link: "#d4a28c",
      border: "#322d29",
      "border-subtle": "#2b2724",
      "composer-ring": "rgb(255 255 255 / 0.2)",
      "interaction-hover": "#2b2724",
      "interaction-selected": "#38312c",
      hairline: "hsl(20 15% 90% / 0.16)",
      "surface-border": "hsl(20 15% 80% / 0.1)",
      "media-outline": "rgba(255, 255, 255, 0.1)",
      "scrollbar-color": "#262220",
      "scrollbar-hover": "#a8a09a",
      scrim: "rgba(0, 0, 0, 0.55)",
      success: "#6fae5f",
      warning: "#e8a75f",
      danger: "#f0908b",
      "success-bg": "#1c2a18",
      "info-bg": "#1f2233",
      "warning-bg": "#332412",
      "danger-bg": "#33201e",
      "success-foreground": "#0f0d0b",
      "warning-foreground": "#0f0d0b",
      "danger-foreground": "#0f0d0b",
      "inverse-bg": "#e8e2dd",
      "inverse-bg-hover": "#fdfcfb",
      "inverse-fg": "#2a2320",
      "accent-skill": "#c2a1ff",
      "accent-steel": "#8aa4c2",
      "accent-teal": "#5ec4ae",
      "accent-gray": "#9a9da4",
      star: "#f5b44a",
      "mermaid-bg": "#1a1817",
      "mermaid-fill": "#262220",
      "mermaid-line": "#3a342f",
    },
    lightPreview: {
      sidebar: "#faf8f6",
      surface: "#fdfcfb",
      canvas: "#f7f5f3",
      accent: "#8a4a2f",
      messageSurface: "#e9e2dc",
      messageAction: "#8a4a2f",
    },
    darkPreview: {
      sidebar: "#1a1817",
      surface: "#121110",
      canvas: "#161413",
      accent: "#c2704d",
      messageSurface: "#2a2623",
      messageAction: "#c2704d",
    },
  },
]
