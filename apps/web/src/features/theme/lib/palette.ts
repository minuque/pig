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
