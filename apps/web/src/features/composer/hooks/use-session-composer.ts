import { computed, type Ref } from "vue"
import type { ModelMetadata, SessionPhase, ThinkingLevel } from "@/types/common-type.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import { useComposerBinding } from "@features/composer/hooks/use-composer-binding.js"
import { projectContextUsage } from "@features/composer/lib/context-usage.js"
import { catalogFromModels, thinkingLevelOf } from "@features/composer/lib/model-preset.js"
import type { ComposerModel, ComposerPreset } from "@features/composer/type.js"

interface ComposerSnapshot {
  model: ComposerModel
  thinkingLevel: ThinkingLevel
}

interface SessionComposerOptions {
  models: Ref<readonly ModelMetadata[]>
  snapshot: Ref<ComposerSnapshot | undefined>
  phase: Ref<SessionPhase | undefined>
  estimate: Ref<ContextUsageEstimate | undefined>
  setModel(model: ComposerModel): Promise<void>
  setThinking(level: ThinkingLevel): Promise<void>
}

/** 目录、执行档和上下文投影。Session 只提供快照和写入。 */
export function useSessionComposer(options: SessionComposerOptions) {
  const catalog = computed(() => catalogFromModels(options.models.value))
  const { preset } = useComposerBinding({
    catalog,
    snapshot: options.snapshot,
    phase: options.phase,
    setModel: options.setModel,
    setThinking: options.setThinking,
  })
  const usage = computed(() => projectContextUsage(options.estimate.value))

  function createModel():
    (Pick<ComposerPreset, "model"> & { thinkingLevel: ThinkingLevel }) | undefined {
    const next = preset.value

    if (!next) return undefined
    return { model: next.model, thinkingLevel: thinkingLevelOf(next.thinkingLevel) }
  }

  return { catalog, preset, usage, createModel }
}
