import { nextTick, ref, watch, type Ref } from "vue"
import type { DefaultModelView, SessionPhase, ThinkingLevel } from "@/types/common-type.js"
import type { ComposerModel, ComposerPreset, ComposerVendor } from "@features/composer/type.js"
import { resolveModelInfo } from "@features/composer/lib/model-preset.js"
import { sameModel, thinkingLevelOf } from "@features/session/lib/model-ref.js"

interface ComposerSnapshot {
  model: ComposerModel
  thinkingLevel: ThinkingLevel
}

interface ComposerBindingOptions {
  catalog: Ref<ComposerVendor[]>
  defaultModel: Ref<DefaultModelView | null>
  snapshot: Ref<ComposerSnapshot | undefined>
  phase: Ref<SessionPhase | undefined>
  setModel(model: ComposerModel): Promise<void>
  setThinking(level: ThinkingLevel): Promise<void>
}

export function useComposerBinding(options: ComposerBindingOptions) {
  const preset = ref<ComposerPreset>()
  const pendingModel = ref(false)
  const detachedEdit = ref(false)
  let suppress = 0

  function writePreset(next: ComposerPreset) {
    suppress += 1
    preset.value = next
    void nextTick(() => {
      suppress -= 1
    })
  }

  function noteDetachedEdit() {
    if (suppress > 0 || options.snapshot.value) return
    detachedEdit.value = true
  }

  function consumeDetachedEdit(): ComposerPreset | undefined {
    if (!detachedEdit.value) return undefined
    detachedEdit.value = false
    return preset.value
  }

  watch(
    [() => options.snapshot.value?.model, () => options.snapshot.value?.thinkingLevel],
    ([model, level]) => {
      if (!model || !level || pendingModel.value || detachedEdit.value) return
      writePreset({ model, thinkingLevel: level })
    },
  )

  watch([() => preset.value?.model, () => preset.value?.thinkingLevel, options.catalog], () => {
    const current = preset.value

    if (!current) return
    const levels = resolveModelInfo(options.catalog.value, current.model).levels

    if (levels.length && !levels.includes(current.thinkingLevel)) {
      writePreset({ ...current, thinkingLevel: levels[0]! })
    }
  })
  watch(
    () => preset.value?.model,
    (model) => {
      noteDetachedEdit()
      const snapshot = options.snapshot.value

      if (!model || !snapshot || options.phase.value !== "idle" || sameModel(model, snapshot.model))
        return
      pendingModel.value = true
      void (async () => {
        try {
          await options.setModel({ provider: model.provider, id: model.id })

          const desired = sameModel(preset.value?.model, model)
            ? preset.value?.thinkingLevel
            : undefined

          if (desired && desired !== options.snapshot.value?.thinkingLevel)
            await options.setThinking(thinkingLevelOf(desired))
        } catch {
        } finally {
          pendingModel.value = false
        }
      })()
    },
  )

  watch([() => preset.value?.thinkingLevel, pendingModel], ([level]) => {
    noteDetachedEdit()
    const snapshot = options.snapshot.value

    if (
      !level ||
      !snapshot ||
      pendingModel.value ||
      options.phase.value !== "idle" ||
      level === snapshot.thinkingLevel
    )
      return
    void options.setThinking(thinkingLevelOf(level)).catch(() => {})
  })

  watch(
    options.defaultModel,
    (initial) => {
      if (preset.value || !initial) return
      writePreset({
        model: { provider: initial.provider, id: initial.id },
        thinkingLevel: initial.thinkingLevel ?? "",
      })
    },
    { immediate: true },
  )
  return { preset, consumeDetachedEdit }
}
