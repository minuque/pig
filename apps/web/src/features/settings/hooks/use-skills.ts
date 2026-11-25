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
import { t } from "@i18n/index.js"
import { notify } from "@pig/ui/toast"

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

  async function mutate(task: () => Promise<unknown>, saved = () => true): Promise<void> {
    try {
      await task()

      if (saved()) notify(t("settings.skills.saved"), "success")
    } catch (cause) {
      notify(errorMessage(cause), "error")
      throw cause
    } finally {
      await refresh()
    }
  }

  function setEnabled(skill: SkillView, enabled: boolean) {
    return mutate(() => setSkillEnabled(scope.value, skill.filePath, enabled)).catch(
      () => undefined,
    )
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

  async function write(path: string, raw: string): Promise<string | undefined> {
    let invalid: string | undefined

    await mutate(
      async () => {
        const result = await writeSkill(scope.value, path, raw)

        if (!result.ok) invalid = result.error
      },
      () => !invalid,
    )
    return invalid
  }

  function remove(path: string) {
    return mutate(() => deleteSkill(scope.value, path))
  }

  watch(scope, refresh, { immediate: true })
  return { view, error, refresh, setEnabled, create, read, write, remove }
}

export type SkillsState = ReturnType<typeof useSkills>
