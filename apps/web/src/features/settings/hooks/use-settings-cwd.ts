import { computed } from "vue"
import { useNav } from "@features/session-nav/index.js"

/** 设置里的资源页跟当前工作目录走：当前会话 → 偏好 → 列表里第一条。 */
export function useSettingsCwd() {
  const { lastCwd, activeWorkspaceId, listedSessions } = useNav()

  return computed(
    () =>
      activeWorkspaceId.value ??
      lastCwd.value ??
      listedSessions.value.find((session) => session.cwd)?.cwd,
  )
}
