import type { PaneView } from "@features/panel-host/lib/pane-view.js"

export type AlertKind = "done" | "error" | "notify" | "changed"

export type AlertTone = "success" | "error" | "info" | "warning"

export type AlertRoute = "toast" | "notification" | "none"

export function routeAlert(kind: AlertKind, view: PaneView | undefined): AlertRoute {
  if (kind === "changed") return "toast"

  if (kind === "notify") return view ? "toast" : "notification"

  if (view === "chat") return "none"

  if (view) return "notification"
  return kind === "done" ? "none" : "notification"
}
