/**
 * 本地 cwd 偏好（Browser platform）。
 * 已授权目录列表与最近使用的 cwd 持久化在 localStorage；
 * 目录授权属于 transport security，不进入任何 Agent Domain。
 * 平台层只处理 canonicalPath 字符串，展示视图由 features 层映射。
 */
import { readonly, ref } from "vue"
import { readPref, writeJson, writePref, type PrefStorage } from "@utils/storage.js"

export const LOCAL_WORKSPACES_KEY = "pig.localWorkspaces"
export const LAST_CWD_KEY = "pig.lastCwd"

import { canonicalizeWorkspacePath } from "@pig/protocol"

/** 旧偏好兼容由 Host realpath 收口，这里只做键规范化。 */
export { canonicalizeWorkspacePath }

/** 规范化后按键去重，保留首次出现顺序。 */
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

/** 解析持久化的目录列表：非法 JSON 或非字符串项一律丢弃。 */
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

/** 本地目录列表偏好：添加/移除立即持久化；select 记录最近使用的 cwd。 */
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
