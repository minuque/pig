import { ref, watch, type Ref } from "vue"
import type { SkillScopeView, SkillView } from "@pig/protocol"

import {
  createSkill,
  deleteSkill,
  getSkillScope,
  readSkill,
  setSkillEnabled,
  writeSkill,
} from "@client/agent-config.js"
import { errorMessage } from "@client/http.js"

export function useSkills(scope: Ref<string>) {
  const view = ref<SkillScopeView>()
  const error = ref<string>()

  async function refresh() {
    error.value = undefined

    try {
      const current = scope.value
      const next = await getSkillScope(current)

      if (current === scope.value) view.value = next
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function setEnabled(skill: SkillView, enabled: boolean) {
    await setSkillEnabled(scope.value, skill.filePath, enabled)
    await refresh()
  }

  async function create(name: string, description: string) {
    const result = await createSkill(scope.value, name, description)

    if ("error" in result) return { error: result.error }
    await refresh()
    return { filePath: result.filePath }
  }

  function read(path: string) {
    return readSkill(scope.value, path)
  }

  async function write(path: string, raw: string) {
    await writeSkill(scope.value, path, raw)
    await refresh()
  }

  async function remove(path: string) {
    await deleteSkill(scope.value, path)
    await refresh()
  }

  watch(scope, refresh, { immediate: true })
  return { view, error, refresh, setEnabled, create, read, write, remove }
}

export type SkillsState = ReturnType<typeof useSkills>
