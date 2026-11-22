import { computed, ref, watch, type Ref } from "vue"
import type { DefaultModelView, SessionPhase, ThinkingLevel } from "@/types/common-type.js"
import type { ComposerModel, ComposerPreset, ComposerVendor } from "@features/composer/type.js"
import { resolveModelInfo } from "@features/composer/lib/model-preset.js"
import { sameModel, thinkingLevelOf } from "@features/session/lib/model-ref.js"

interface ComposerSnapshot {
  id?: string
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

type PendingPreset =
  | { readonly kind: "detached"; readonly preset: ComposerPreset }
  | { readonly kind: "sync"; readonly version: number; readonly preset: ComposerPreset }

function normalizePreset(
  candidate: ComposerPreset | undefined,
  catalog: ComposerVendor[],
): ComposerPreset | undefined {
  if (!candidate) return undefined
  const levels = resolveModelInfo(catalog, candidate.model).levels

  if (levels.length && !levels.includes(candidate.thinkingLevel)) {
    return { ...candidate, thinkingLevel: levels[0]! }
  }

  return candidate
}

function samePreset(a: ComposerPreset, b: ComposerPreset): boolean {
  return sameModel(a.model, b.model) && a.thinkingLevel === b.thinkingLevel
}

export function useComposerBinding(options: ComposerBindingOptions) {
  const pending = ref<PendingPreset>()
  let syncVersion = 0
  let syncing = false
  const switchLocked = computed(
    () => options.phase.value !== undefined && options.phase.value !== "idle",
  )
  const basePreset = computed<ComposerPreset | undefined>(() => {
    const snap = options.snapshot.value

    if (snap) return { model: snap.model, thinkingLevel: snap.thinkingLevel }
    const initial = options.defaultModel.value

    if (!initial) return undefined
    return {
      model: { provider: initial.provider, id: initial.id },
      thinkingLevel: initial.thinkingLevel ?? "",
    }
  })

  async function flushSync() {
    if (syncing) return
    syncing = true

    try {
      while (pending.value?.kind === "sync") {
        const current = pending.value
        const snap = options.snapshot.value

        if (!snap || options.phase.value !== "idle") {
          if (pending.value === current) pending.value = undefined
          break
        }

        const target = normalizePreset(current.preset, options.catalog.value) ?? current.preset

        try {
          if (!sameModel(target.model, snap.model)) {
            await options.setModel({ provider: target.model.provider, id: target.model.id })

            if (pending.value?.kind !== "sync" || pending.value.version !== current.version) {
              continue
            }
          }

          const afterSnap = options.snapshot.value
          const afterTarget =
            normalizePreset(current.preset, options.catalog.value) ?? current.preset

          if (
            afterSnap &&
            options.phase.value === "idle" &&
            afterTarget.thinkingLevel &&
            afterTarget.thinkingLevel !== afterSnap.thinkingLevel
          ) {
            await options.setThinking(thinkingLevelOf(afterTarget.thinkingLevel))

            if (pending.value?.kind !== "sync" || pending.value.version !== current.version) {
              continue
            }
          }

          if (pending.value?.kind === "sync" && pending.value.version === current.version) {
            pending.value = undefined
          }

          break
        } catch {
          if (pending.value?.kind === "sync" && pending.value.version === current.version) {
            pending.value = undefined
          }
        }
      }
    } finally {
      syncing = false
    }
  }

  const preset = computed<ComposerPreset | undefined>({
    get: () => normalizePreset(pending.value?.preset ?? basePreset.value, options.catalog.value),
    set: (next) => {
      if (!next) return
      const normalized = normalizePreset(next, options.catalog.value) ?? next
      const snap = options.snapshot.value

      if (!snap) {
        pending.value = { kind: "detached", preset: normalized }
        return
      }

      if (options.phase.value !== "idle") return

      if (
        !pending.value &&
        samePreset(normalized, { model: snap.model, thinkingLevel: snap.thinkingLevel })
      ) {
        return
      }

      pending.value = { kind: "sync", version: ++syncVersion, preset: normalized }
      void flushSync()
    },
  })

  watch(
    () => options.snapshot.value?.id,
    () => {
      if (pending.value?.kind === "sync") pending.value = undefined
    },
  )

  function consumeDetachedEdit(): ComposerPreset | undefined {
    if (pending.value?.kind !== "detached") return undefined
    const chosen = normalizePreset(pending.value.preset, options.catalog.value)
    pending.value = undefined
    return chosen
  }

  return { preset, consumeDetachedEdit, switchLocked }
}
