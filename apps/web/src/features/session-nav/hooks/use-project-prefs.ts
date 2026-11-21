import { readonly, shallowRef } from "vue"
import { readJson, writeJson } from "@utils/storage.js"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import {
  parseProjectPrefs,
  type ProjectIconChoice,
  type ProjectPrefs,
} from "@features/session-nav/lib/project-prefs.js"

const PREFS_KEY = "pig.projectPrefs"
const prefs = shallowRef<ProjectPrefs>(parseProjectPrefs(readJson(PREFS_KEY)))

function save(next: ProjectPrefs): void {
  prefs.value = next
  writeJson(PREFS_KEY, next)
}

export function useProjectPrefs() {
  function iconOf(path: string | undefined): ProjectIconChoice | undefined {
    return path ? prefs.value.icons[canonicalizeWorkspacePath(path)] : undefined
  }

  function isPinned(path: string): boolean {
    return prefs.value.pinned.includes(path)
  }

  function togglePinned(path: string): void {
    const pinned = isPinned(path)
      ? prefs.value.pinned.filter((item) => item !== path)
      : [...prefs.value.pinned, path]

    save({ ...prefs.value, pinned })
  }

  function setIcon(path: string, choice: ProjectIconChoice | undefined): void {
    const icons = { ...prefs.value.icons }

    if (choice) icons[path] = choice
    else delete icons[path]
    save({ ...prefs.value, icons })
  }

  return { prefs: readonly(prefs), iconOf, isPinned, togglePinned, setIcon }
}
