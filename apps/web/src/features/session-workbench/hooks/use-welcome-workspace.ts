import { computed, shallowRef, watch } from "vue"
import { warmWorkspace } from "@client/platform.js"

interface WelcomeWorkspaceDeps {
  sessionId(): string | undefined
  sessionCwd(): string | undefined
  /** 与侧栏同一份目录：已授权 local + 会话 cwd。 */
  workspaces(): readonly string[]
  lastCwd(): string | undefined
  connected(): boolean
}

/** 失效项兜底：手选的目录还在就保住，其次是侧栏最近一次点的。 */
function nextWorkspaceId(
  items: readonly string[],
  current: string | undefined,
  lastCwd: string | undefined,
): string | undefined {
  if (items.includes(current ?? "")) return current

  if (lastCwd !== undefined && items.includes(lastCwd)) return lastCwd
  return items[0]
}

/** 首屏 Hero 的目录：跟随侧栏选择、目录变化兜底，连上后预热同一目录的扩展与技能。 */
export function useWelcomeWorkspace(deps: WelcomeWorkspaceDeps) {
  const welcomeWorkspaceId = shallowRef<string>()
  const heroWorkspaceId = computed({
    get: () => (deps.sessionId() ? deps.sessionCwd() : welcomeWorkspaceId.value),
    set: (id) => {
      if (!deps.sessionId()) welcomeWorkspaceId.value = id
    },
  })
  const composerCwd = computed(() =>
    deps.sessionId() ? deps.sessionCwd() : welcomeWorkspaceId.value,
  )

  // 侧栏点目录会写 lastCwd，Hero 跟随
  watch(
    () => deps.lastCwd(),
    (last) => {
      if (last !== undefined) welcomeWorkspaceId.value = last
    },
  )

  watch(
    () => deps.workspaces(),
    (items) => {
      welcomeWorkspaceId.value = nextWorkspaceId(items, welcomeWorkspaceId.value, deps.lastCwd())
    },
    { immediate: true },
  )

  // 第一条 Prompt 用这个目录建会话；连上后让 Host 后台预热同一目录的扩展与技能
  watch(
    [() => deps.connected(), welcomeWorkspaceId],
    ([live, id]) => {
      if (live && id) void warmWorkspace(id).catch(() => undefined)
    },
    { immediate: true },
  )
  return { welcomeWorkspaceId, heroWorkspaceId, composerCwd }
}
