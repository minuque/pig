import { inject, provide, type InjectionKey, type Ref } from "vue"
import type { DefaultModelView, ModelMetadata } from "@/types/common-type.js"
import { t } from "@i18n/index.js"
import { useSessionComposer } from "@features/composer/hooks/use-session-composer.js"
import type { SessionContext } from "@features/session/index.js"

export type ComposerPresetContext = Pick<
  ReturnType<typeof useSessionComposer>,
  "catalog" | "preset"
>

const composerPresetKey: InjectionKey<ComposerPresetContext> = Symbol("composer-preset")

/** 一侧会话的模型选择：把「用户选了什么」注册回 session，返回目录与执行档。 */
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

  session.setPresetPort({ createModel, consumeDetachedEdit })
  return { catalog, preset }
}

/** 把一侧的模型选择交给子树；和 provideSession 成对调用。 */
export function provideComposerPreset(context: ComposerPresetContext) {
  provide(composerPresetKey, context)
  return context
}

export function useComposerPreset(): ComposerPresetContext {
  const context = inject(composerPresetKey)

  if (!context) throw new Error("useComposerPreset() 需要在 provideComposerPreset() 之后调用")
  return context
}

/** 输入卡占位文案：欢迎页与会话页共用一处；组件内读时取当前语言。 */
export function promptPlaceholder(): string {
  return t("composer.placeholder")
}
