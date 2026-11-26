import type { PaneView } from "@features/panel-host/lib/pane-view.js"

export type AlertKind = "done" | "error" | "notify" | "changed"

export type AlertTone = "success" | "error" | "info" | "warning"

export interface PaneAlert {
  kind: AlertKind
  tone: AlertTone
  title: string
  body?: string | undefined
}

export type AlertRoute = "island" | "toast" | "none"

const SEEN_IN_CHAT = new Set<AlertKind>(["done", "error"])

export function routeAlert(kind: AlertKind, view: PaneView | undefined): AlertRoute {
  if (!view) return kind === "done" ? "none" : "toast"
  return view === "chat" && SEEN_IN_CHAT.has(kind) ? "none" : "island"
}

export const ALERT_TTL: Record<AlertKind, number> = {
  done: 4000,
  error: 6000,
  notify: 4000,
  changed: 4000,
}
