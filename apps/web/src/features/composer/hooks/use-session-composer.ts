import { computed, type Ref } from "vue"
import type {
  DefaultModelView,
  ModelMetadata,
  SessionPhase,
  ThinkingLevel,
} from "@/types/common-type.js"
import { useComposerBinding } from "@features/composer/hooks/use-composer-binding.js"
import { catalogFromModels } from "@features/composer/lib/model-preset.js"
import type { ComposerModel, ComposerPreset } from "@features/composer/type.js"
import { thinkingLevelOf } from "@features/session/lib/model-ref.js"

interface ComposerSnapshot {
  model: ComposerModel
  thinkingLevel: ThinkingLevel
}

interface SessionComposerOptions {
  models: Ref<readonly ModelMetadata[]>
  defaultModel: Ref<DefaultModelView | null>
  snapshot: Ref<ComposerSnapshot | undefined>
  phase: Ref<SessionPhase | undefined>
  setModel(model: ComposerModel): Promise<void>
  setThinking(level: ThinkingLevel): Promise<void>
}

export function useSessionComposer(options: SessionComposerOptions) {
  const catalog = computed(() => catalogFromModels(options.models.value))
  const { preset, consumeDetachedEdit } = useComposerBinding({
    catalog,
    defaultModel: options.defaultModel,
    snapshot: options.snapshot,
    phase: options.phase,
    setModel: options.setModel,
    setThinking: options.setThinking,
  })

  function createModel():
    (Pick<ComposerPreset, "model"> & { thinkingLevel: ThinkingLevel }) | undefined {
    const next = preset.value

    if (!next) return undefined
    return { model: next.model, thinkingLevel: thinkingLevelOf(next.thinkingLevel) }
  }

  return { catalog, preset, createModel, consumeDetachedEdit }
}
