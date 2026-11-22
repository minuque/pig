import { computed, inject, provide, type InjectionKey, type Ref } from "vue"
import type { DefaultModelView, ModelMetadata } from "@/types/common-type.js"
import { useSessionComposer } from "@features/composer/hooks/use-session-composer.js"
import type { SessionContext } from "@features/session/index.js"

export { default as QueuedMessages } from "@features/composer/components/QueuedMessages.vue"

export { formatThinkingLevel } from "@features/composer/lib/thinking-level.js"

export type ComposerPresetContext = Pick<
  ReturnType<typeof useSessionComposer>,
  "catalog" | "preset"
> & { switchLocked: Readonly<Ref<boolean>> }

const composerPresetKey: InjectionKey<ComposerPresetContext> = Symbol("composer-preset")

export function bindComposerPreset(
  session: SessionContext,
  models: Ref<readonly ModelMetadata[]>,
  defaultModel: Ref<DefaultModelView | null>,
): ComposerPresetContext {
  const { catalog, preset, createModel, consumeDetachedEdit } = useSessionComposer({
    models,
    defaultModel,
    snapshot: session.snapshot,
    phase: session.phase,
    setModel: session.setModel,
    setThinking: session.setThinking,
  })
  const switchLocked = computed(
    () => session.phase.value !== undefined && session.phase.value !== "idle",
  )

  session.setPresetPort({ createModel, consumeDetachedEdit })
  return { catalog, preset, switchLocked }
}

export function provideComposerPreset(context: ComposerPresetContext) {
  provide(composerPresetKey, context)
  return context
}

export function useComposerPreset(): ComposerPresetContext {
  const context = inject(composerPresetKey)

  if (!context) throw new Error("useComposerPreset() 需要在 provideComposerPreset() 之后调用")
  return context
}
