export { default as Callout } from "./Callout.vue"

export type CalloutVariant = "soft" | "surface" | "outline"

export type CalloutColor = "neutral" | "info" | "success" | "warning" | "destructive"

export type CalloutSize = "1" | "2" | "3"

export const calloutSize: Record<CalloutSize, string> = {
  "1": "gap-0.5 px-(--space-xs) py-(--space-xxs) text-caption",
  "2": "gap-1 px-(--space-xs) py-(--space-xs) text-body-sm",
  "3": "gap-1.5 px-(--space-sm) py-(--space-sm) text-body-lg",
}
const neutral = {
  soft: "border-border bg-(--interaction-hover) text-foreground",
  surface: "border-border bg-card text-foreground",
  outline: "border-border bg-transparent text-foreground",
}
const info = {
  soft: "border-info/25 bg-(--info-bg) text-info",
  surface: "border-info/40 bg-card text-info",
  outline: "border-info/50 bg-transparent text-info",
}
const success = {
  soft: "border-success/25 bg-(--success-bg) text-success",
  surface: "border-success/40 bg-card text-success",
  outline: "border-success/50 bg-transparent text-success",
}
const warning = {
  soft: "border-warning/25 bg-(--warning-bg) text-warning",
  surface: "border-warning/40 bg-card text-warning",
  outline: "border-warning/50 bg-transparent text-warning",
}
const destructive = {
  soft: "border-destructive/25 bg-(--destructive-bg) text-(--destructive-on-tint)",
  surface: "border-destructive/40 bg-card text-destructive",
  outline: "border-destructive/50 bg-transparent text-destructive",
}
export const calloutColor: Record<CalloutColor, Record<CalloutVariant, string>> = {
  neutral,
  info,
  success,
  warning,
  destructive,
}
