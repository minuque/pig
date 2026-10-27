import { computed } from "vue"
import { useNav, type NavContext } from "@features/session-nav/index.js"

/** 算 cwd 只需这三个源；持有 nav 的调用方可以按需传入。 */
export type SettingsCwdSource = Pick<NavContext, "lastCwd" | "activeWorkspaceId" | "listedSessions">

/** 设置里的资源页跟当前工作目录走：当前会话 → 偏好 → 列表里第一条。 */
export function useSettingsCwd(nav?: SettingsCwdSource) {
  const source = nav ?? useNav()
  return computed(
    () =>
      source.activeWorkspaceId.value ??
      source.lastCwd.value ??
      source.listedSessions.value.find((session) => session.cwd)?.cwd,
  )
}
