import type {
  SidebarSession,
  SidebarSessionState,
  SidebarStateGlyph,
} from "@features/session-nav/type.js"

/** 行内图标：运行中 > 未读 > 草稿 > 错误。 */
export function sessionGlyph(
  session: Pick<SidebarSession, "draft">,
  state: SidebarSessionState | undefined,
): SidebarStateGlyph | undefined {
  if (state === "running") return "running"

  if (state === "unread") return "unread"

  if (session.draft) return "draft"

  if (state === "error") return "error"
  return undefined
}
