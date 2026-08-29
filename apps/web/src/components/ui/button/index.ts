export { default as Button } from "./Button.vue"

export const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,opacity,scale] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

export const buttonVariant = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
} as const

export const buttonSize = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  icon: "size-9",
  "icon-2xs": "size-[18px] rounded-full [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-8",
} as const

export type ButtonVariant = keyof typeof buttonVariant
export type ButtonSize = keyof typeof buttonSize
