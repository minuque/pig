import { readonly, ref } from "vue"
import { canonicalizeWorkspacePath } from "@pig/protocol"
import { readPref, writeJson, writePref, type PrefStorage } from "@utils/storage.js"

export { canonicalizeWorkspacePath }

export const LOCAL_WORKSPACES_KEY = "pig.localWorkspaces"
export const LAST_CWD_KEY = "pig.lastCwd"

export function uniqueCanonicalPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []

  for (const path of paths) {
    const canonical = canonicalizeWorkspacePath(path)

    if (!canonical || seen.has(canonical)) continue
    seen.add(canonical)
    next.push(canonical)
  }

  return next
}

export function parseLocalWorkspaces(json: string | null): string[] {
  if (!json) return []

  try {
    const value: unknown = JSON.parse(json)

    if (!Array.isArray(value)) return []
    return uniqueCanonicalPaths(
      value.filter((item): item is string => typeof item === "string" && item.length > 0),
    )
  } catch {
    return []
  }
}

export function loadLocalWorkspaces(storage: PrefStorage = localStorage): string[] {
  return parseLocalWorkspaces(readPref(LOCAL_WORKSPACES_KEY, storage) ?? null)
}

export function saveLocalWorkspaces(
  paths: readonly string[],
  storage: PrefStorage = localStorage,
): void {
  writeJson(LOCAL_WORKSPACES_KEY, paths, storage)
}

export function loadLastCwd(storage: PrefStorage = localStorage): string | undefined {
  return readPref(LAST_CWD_KEY, storage)
}

export function saveLastCwd(path: string, storage: PrefStorage = localStorage): void {
  writePref(LAST_CWD_KEY, path, storage)
}

export function useLocalWorkspaces() {
  const workspaces = ref<string[]>(loadLocalWorkspaces())
  const lastCwd = ref<string | undefined>(loadLastCwd())

  function add(path: string) {
    const canonicalPath = canonicalizeWorkspacePath(path)

    if (!canonicalPath || workspaces.value.includes(canonicalPath)) return
    workspaces.value = [...workspaces.value, canonicalPath]
    saveLocalWorkspaces(workspaces.value)
  }

  function remove(path: string) {
    const canonicalPath = canonicalizeWorkspacePath(path)
    workspaces.value = workspaces.value.filter((item) => item !== canonicalPath)
    saveLocalWorkspaces(workspaces.value)
  }

  function selectCwd(path: string) {
    lastCwd.value = canonicalizeWorkspacePath(path)
    saveLastCwd(lastCwd.value)
  }

  return {
    workspaces: readonly(workspaces),
    lastCwd: readonly(lastCwd),
    add,
    remove,
    selectCwd,
  }
}
