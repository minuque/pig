import type { UserPalette } from "@/types/common-type.js"

export const PALETTE_LABELS = {
  pig: "pig",
  catppuccin: "Catppuccin",
  "rose-pine": "Rosé Pine",
  solarized: "Solarized",
  gruvbox: "Gruvbox",
  nord: "Nord",
  "tokyo-night": "Tokyo Night",
  dracula: "Dracula",
} as const satisfies Record<UserPalette, string>
