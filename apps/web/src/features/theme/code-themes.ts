import type { UserCodeTheme } from "@/types/common-type.js"

export const CODE_THEME_OPTIONS = {
  github: { label: "GitHub", light: "github-light", dark: "github-dark" },
  catppuccin: { label: "Catppuccin", light: "catppuccin-latte", dark: "catppuccin-mocha" },
  "rose-pine": { label: "Rosé Pine", light: "rose-pine-dawn", dark: "rose-pine" },
  solarized: { label: "Solarized", light: "solarized-light", dark: "solarized-dark" },
  gruvbox: { label: "Gruvbox", light: "gruvbox-light-medium", dark: "gruvbox-dark-medium" },
  one: { label: "Atom One", light: "one-light", dark: "one-dark-pro" },
  vitesse: { label: "Vitesse", light: "vitesse-light", dark: "vitesse-dark" },
  everforest: { label: "Everforest", light: "everforest-light", dark: "everforest-dark" },
  kanagawa: { label: "Kanagawa", light: "kanagawa-lotus", dark: "kanagawa-wave" },
  ayu: { label: "Ayu", light: "ayu-light", dark: "ayu-dark" },
  "night-owl": { label: "Night Owl", light: "night-owl-light", dark: "night-owl" },
  material: { label: "Material", light: "material-theme-lighter", dark: "material-theme-darker" },
  vscode: { label: "VS Code", light: "light-plus", dark: "dark-plus" },
} as const satisfies Record<UserCodeTheme, { label: string; light: string; dark: string }>

type Pair = (typeof CODE_THEME_OPTIONS)[UserCodeTheme]

export type CodeBlockTheme = Pair["light"] | Pair["dark"]

export function codeBlockTheme(id: UserCodeTheme, dark: boolean): CodeBlockTheme {
  const pair = CODE_THEME_OPTIONS[id]
  return dark ? pair.dark : pair.light
}
