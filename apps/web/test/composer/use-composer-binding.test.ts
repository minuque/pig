import { describe, expect, it, vi } from "vitest"
import { nextTick, ref } from "vue"
import type { SessionSnapshot } from "@/types/common-type.js"
import { useComposerBinding } from "@features/composer/hooks/use-composer-binding.js"
import type { ComposerVendor } from "@/types/composer-type.js"

const catalog: ComposerVendor[] = [
  { id: "a", name: "A", models: [{ id: "one", name: "One", thinkingLevels: ["high"] }] },
  { id: "b", name: "B", models: [{ id: "two", name: "Two", thinkingLevels: ["low"] }] },
]

const pickerCatalog: ComposerVendor[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet", name: "Claude Sonnet", thinkingLevels: ["low", "high"] },
      { id: "claude-haiku", name: "Claude Haiku", thinkingLevels: ["low"] },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [{ id: "gpt-4o", name: "GPT-4o", thinkingLevels: ["off"] }],
  },
]

function snapshot(model = { provider: "a", id: "one" }, thinkingLevel = "high") {
  return {
    id: "s1",
    cwd: "/tmp",
    createdAt: 1,
    updatedAt: 1,
    phase: "idle",
    model,
    thinkingLevel,
    attached: true,
    locked: false,
    revision: 1,
    transcript: [],
    queuedSteer: [],
    queuedSteerCount: 0,
  } as SessionSnapshot
}

describe("useComposerBinding", () => {
  it("切换模型时保留自动修正的 thinking，并在模型回执后下发", async () => {
    const state = ref(snapshot())
    let release!: () => void
    const setModel = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          release = () => {
            state.value = snapshot({ provider: "b", id: "two" }, "high")
            resolve()
          }
        }),
    )
    const setThinking = vi.fn(async (level: string) => {
      state.value = snapshot({ provider: "b", id: "two" }, level)
    })
    const phase = ref<"idle" | undefined>("idle")
    const { preset } = useComposerBinding({
      catalog: ref(catalog),
      snapshot: state,
      phase,
      setModel,
      setThinking,
    })

    state.value = snapshot()
    await nextTick()
    preset.value = { model: { provider: "b", id: "two" }, thinkingLevel: "low" }
    await nextTick()
    expect(setModel).toHaveBeenCalledWith({ provider: "b", id: "two" })
    expect(preset.value?.thinkingLevel).toBe("low")

    release()
    await new Promise((resolve) => setTimeout(resolve))
    expect(setThinking).toHaveBeenCalledWith("low")
    expect(preset.value).toEqual({ model: { provider: "b", id: "two" }, thinkingLevel: "low" })
  })

  it("切模型后 thinkingLevel 不在新档位则回落第一档再下发", async () => {
    const sonnet = { provider: "anthropic", id: "claude-sonnet" }
    const gpt = { provider: "openai", id: "gpt-4o" }
    const state = ref(snapshot(sonnet, "high"))
    let release!: () => void
    const setModel = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          release = () => {
            state.value = snapshot(gpt, "high")
            resolve()
          }
        }),
    )
    const setThinking = vi.fn(async (level: string) => {
      state.value = snapshot(state.value.model, level)
    })
    const phase = ref<"idle" | undefined>("idle")
    const { preset } = useComposerBinding({
      catalog: ref(pickerCatalog),
      snapshot: state,
      phase,
      setModel,
      setThinking,
    })

    state.value = snapshot(sonnet, "high")
    await nextTick()
    // 输入卡只改模型，档位仍是旧值；binding 负责回落
    preset.value = { model: gpt, thinkingLevel: "high" }
    await nextTick()
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })
    expect(setModel).toHaveBeenCalledWith(gpt)

    release()
    await new Promise((resolve) => setTimeout(resolve))
    expect(setThinking).toHaveBeenCalledWith("off")
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })
  })
})
