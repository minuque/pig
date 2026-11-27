import { ref, watch, type Ref } from "vue"
import type { SkillScopeView, SkillView } from "@pig/protocol"

import {
  createSkill,
  deleteSkill,
  getSkillScope,
  readSkill,
  readSkillAsset,
  setSkillEnabled,
  writeSkill,
} from "@client/agent-config.js"
import { errorMessage } from "@client/http.js"
import { t } from "@i18n/index.js"
import { toastStatus } from "@pig/ui/toast"

export function useSkills(scope: Ref<string>) {
  const view = ref<SkillScopeView>()
  const error = ref<string>()

  async function refresh(options?: { preserveError?: boolean }) {
    if (!options?.preserveError) error.value = undefined

    try {
      const current = scope.value
      const next = await getSkillScope(current)

      if (current === scope.value) view.value = next
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function mutate(
    task: () => Promise<unknown>,
    options: { saved?: () => boolean; messageKey?: string } = {},
  ): Promise<void> {
    error.value = undefined
    const saved = options.saved ?? (() => true)
    let failed = false

    try {
      await task()

      if (saved())
        toastStatus(t(options.messageKey ?? "settings.skills.saved"), { tone: "success" })
    } catch (cause) {
      failed = true
      error.value = errorMessage(cause)
      throw cause
    } finally {
      await refresh({ preserveError: failed })
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

  function readAsset(path: string, file: string) {
    return readSkillAsset(scope.value, path, file)
  }

  async function write(path: string, raw: string): Promise<string | undefined> {
    let invalid: string | undefined

    await mutate(
      async () => {
        const result = await writeSkill(scope.value, path, raw)

        if (!result.ok) invalid = result.error
      },
      { saved: () => !invalid },
    )
    return invalid
  }

  function remove(path: string) {
    return mutate(() => deleteSkill(scope.value, path), { messageKey: "settings.skills.deleted" })
  }

  watch(scope, () => void refresh(), { immediate: true })
  return { view, error, refresh, setEnabled, create, read, readAsset, write, remove }
}

export type SkillsState = ReturnType<typeof useSkills>
