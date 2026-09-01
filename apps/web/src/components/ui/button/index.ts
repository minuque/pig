export { default as Button } from "./Button.vue"

export const buttonBase =
  "inline-flex items-center justify-center gap-(--spacing-xs) whitespace-nowrap rounded-md text-button font-medium transition-[background-color,color,box-shadow,opacity,scale] duration-(--duration-fast) ease-(--ease-out) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-(--size-icon) shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[length:var(--focus-ring-width)]"

export const buttonPress = "active:not-disabled:scale-[0.96] motion-reduce:active:scale-100"

export const buttonVariant = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline:
    "border bg-background shadow-soft hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
} as const

export const buttonSize = {
  default: "h-8 px-3 py-1.5 has-[>svg]:px-2.5",
  icon: "size-(--size-icon-button)",
  "icon-2xs": "size-(--size-icon-2xs) rounded-full [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
} as const

export type ButtonVariant = keyof typeof buttonVariant
export type ButtonSize = keyof typeof buttonSize
