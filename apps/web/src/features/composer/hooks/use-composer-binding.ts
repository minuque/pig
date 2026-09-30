import { nextTick, ref, watch, type Ref } from "vue"
import type { SessionPhase, ThinkingLevel } from "@/types/common-type.js"
import type { ComposerModel, ComposerPreset, ComposerVendor } from "@features/composer/type.js"
import {
  defaultPresetFrom,
  resolveModelInfo,
  sameModel,
  thinkingLevelOf,
} from "@features/composer/lib/model-preset.js"

interface ComposerSnapshot {
  model: ComposerModel
  thinkingLevel: ThinkingLevel
}

interface ComposerBindingOptions {
  catalog: Ref<ComposerVendor[]>
  snapshot: Ref<ComposerSnapshot | undefined>
  phase: Ref<SessionPhase | undefined>
  setModel(model: ComposerModel): Promise<void>
  setThinking(level: ThinkingLevel): Promise<void>
}

/** Session 快照与模型选择器之间唯一的双向同步点。 */
export function useComposerBinding(options: ComposerBindingOptions) {
  const preset = ref<ComposerPreset>()
  // 回声抑制：setModel 在途时快照仍是旧模型，不让快照回写覆盖用户刚选的值
  const pendingModel = ref(false)
  // 未 attach 时用户改过的档位，打开会话前不能被快照盖掉
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

  // 切模型或目录变化后，当前 thinkingLevel 不在新档位里则回落到第一档
  watch([() => preset.value?.model, () => preset.value?.thinkingLevel, options.catalog], () => {
    const current = preset.value

    if (!current) return
    const levels = resolveModelInfo(options.catalog.value, current.model).levels

    if (levels.length && !levels.includes(current.thinkingLevel)) {
      preset.value = { ...current, thinkingLevel: levels[0]! }
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
          /* 切模型失败不在输入卡展示 */
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
    void options.setThinking(thinkingLevelOf(level)).catch(() => {
      /* 切档位失败不在输入卡展示 */
    })
  })

  watch(
    options.catalog,
    (items) => {
      const fallback = defaultPresetFrom(items)

      if (!preset.value && fallback) writePreset(fallback)
    },
    { immediate: true },
  )
  return { preset, consumeDetachedEdit }
}
