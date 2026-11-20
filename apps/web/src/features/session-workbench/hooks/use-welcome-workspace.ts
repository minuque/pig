import { computed, shallowRef, watch } from "vue"
import { warmWorkspace } from "@client/platform.js"

interface WelcomeWorkspaceDeps {
  sessionId(): string | undefined
  sessionCwd(): string | undefined
  workspaces(): readonly string[]
  lastCwd(): string | undefined
  connected(): boolean
}

function nextWorkspaceId(
  items: readonly string[],
  current: string | undefined,
  lastCwd: string | undefined,
): string | undefined {
  if (items.includes(current ?? "")) return current

  if (lastCwd !== undefined && items.includes(lastCwd)) return lastCwd
  return items[0]
}

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

  watch(
    [() => deps.connected(), welcomeWorkspaceId],
    ([live, id]) => {
      if (live && id) void warmWorkspace(id).catch(() => undefined)
    },
    { immediate: true },
  )
  return { welcomeWorkspaceId, heroWorkspaceId, composerCwd }
}
