export type ColorScheme = "auto" | "light" | "dark"

export type ThemePresetId = "linear" | "paper" | "ocean" | "grove" | "iris"

export type RadixAccentColor = "indigo" | "orange" | "blue" | "green" | "violet"

export type ThemeSeed = Readonly<{ canvas: string; accent: string }>

export type ThemePreset = Readonly<{
  id: ThemePresetId
  radixAccent: RadixAccentColor
  light: ThemeSeed
  dark: ThemeSeed
}>
