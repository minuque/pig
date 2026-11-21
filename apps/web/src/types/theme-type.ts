export type ColorScheme = "auto" | "light" | "dark"

export type ThemePresetId = "linear" | "paper" | "ocean" | "grove" | "iris"

export type ThemeSeed = Readonly<{ canvas: string; accent: string }>

export type ThemePreset = Readonly<{
  id: ThemePresetId
  light: ThemeSeed
  dark: ThemeSeed
}>
