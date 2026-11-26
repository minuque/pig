import type {
  SidebarSession,
  SidebarSessionState,
  SidebarStateGlyph,
} from "@features/session-nav/type.js"

export function sessionGlyph(
  session: Pick<SidebarSession, "draft">,
  state: SidebarSessionState | undefined,
): SidebarStateGlyph | undefined {
  if (state === "waiting") return "waiting"

  if (state === "running") return "running"

  if (state === "unread") return "unread"

  if (session.draft) return "draft"

  if (state === "error") return "error"
  return undefined
}
