import { describe, expect, it, vi } from "vitest"
import { nextTick, ref } from "vue"
import type { SessionSnapshot } from "@/types/common-type.js"
import { useComposerBinding } from "@features/composer/hooks/use-composer-binding.js"
import type { ComposerVendor } from "@features/composer/type.js"

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
    tasks: [],
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
      defaultModel: ref(null),
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
      defaultModel: ref(null),
      snapshot: state,
      phase,
      setModel,
      setThinking,
    })

    state.value = snapshot(sonnet, "high")
    await nextTick()
    preset.value = { model: gpt, thinkingLevel: "high" }
    await nextTick()
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })
    expect(setModel).toHaveBeenCalledWith(gpt)

    release()
    await new Promise((resolve) => setTimeout(resolve))
    expect(setThinking).toHaveBeenCalledWith("off")
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })
  })

  it("未打开会话时预选设置里的默认模型与档位，不算用户修改；手选后不被随后的快照盖掉", async () => {
    const state = ref<SessionSnapshot | undefined>(undefined)
    const { preset, consumeDetachedEdit } = useComposerBinding({
      catalog: ref(catalog),
      defaultModel: ref({ provider: "b", id: "two", thinkingLevel: "low" as const }),
      snapshot: state,
      phase: ref("idle"),
      setModel: vi.fn(async () => undefined),
      setThinking: vi.fn(async () => undefined),
    })

    await nextTick()
    expect(preset.value).toEqual({ model: { provider: "b", id: "two" }, thinkingLevel: "low" })
    expect(consumeDetachedEdit()).toBeUndefined()
    preset.value = { model: { provider: "a", id: "one" }, thinkingLevel: "high" }
    await nextTick()
    state.value = snapshot({ provider: "b", id: "two" }, "low")
    await nextTick()
    expect(preset.value).toEqual({ model: { provider: "a", id: "one" }, thinkingLevel: "high" })
    expect(consumeDetachedEdit()).toEqual({
      model: { provider: "a", id: "one" },
      thinkingLevel: "high",
    })
  })

  it("默认模型的档位缺失或不在支持列表时，目录后到引起的自动回落不算用户修改，随后打开会话按快照选中模型", async () => {
    const cases = [
      [{ provider: "a", id: "one" }, ""],
      [{ provider: "a", id: "one", thinkingLevel: "low" as const }, "low"],
    ] as const

    for (const [initial, configured] of cases) {
      const state = ref<SessionSnapshot | undefined>(undefined)
      const vendors = ref<ComposerVendor[]>([])
      const { preset, consumeDetachedEdit } = useComposerBinding({
        catalog: vendors,
        defaultModel: ref(initial),
        snapshot: state,
        phase: ref("idle"),
        setModel: vi.fn(async () => undefined),
        setThinking: vi.fn(async () => undefined),
      })

      await nextTick()
      expect(preset.value).toEqual({
        model: { provider: "a", id: "one" },
        thinkingLevel: configured,
      })

      vendors.value = catalog
      await nextTick()
      expect(preset.value).toEqual({ model: { provider: "a", id: "one" }, thinkingLevel: "high" })
      expect(consumeDetachedEdit()).toBeUndefined()

      state.value = snapshot({ provider: "b", id: "two" }, "low")
      await nextTick()
      expect(preset.value).toEqual({ model: { provider: "b", id: "two" }, thinkingLevel: "low" })
      expect(consumeDetachedEdit()).toBeUndefined()
    }
  })

  it("设置里没配默认模型时不预选，不拿目录里的模型顶上", async () => {
    const { preset } = useComposerBinding({
      catalog: ref(catalog),
      defaultModel: ref(null),
      snapshot: ref(undefined),
      phase: ref("idle"),
      setModel: vi.fn(async () => undefined),
      setThinking: vi.fn(async () => undefined),
    })

    await nextTick()
    expect(preset.value).toBeUndefined()
  })

  it("setModel 在途收到旧快照回声不回盖，中途再切第三个模型会顺次下发", async () => {
    const sonnet = { provider: "anthropic", id: "claude-sonnet" }
    const haiku = { provider: "anthropic", id: "claude-haiku" }
    const gpt = { provider: "openai", id: "gpt-4o" }
    const state = ref(snapshot(sonnet, "high"))
    const releases: Array<() => void> = []
    const setModel = vi.fn(
      async (model: { provider: string; id: string }) =>
        new Promise<void>((resolve) => {
          releases.push(() => {
            state.value = snapshot(model, "high")
            resolve()
          })
        }),
    )
    const setThinking = vi.fn(async (level: string) => {
      state.value = snapshot(state.value.model, level)
    })
    const { preset } = useComposerBinding({
      catalog: ref(pickerCatalog),
      defaultModel: ref(null),
      snapshot: state,
      phase: ref("idle"),
      setModel,
      setThinking,
    })

    preset.value = { model: haiku, thinkingLevel: "low" }
    await nextTick()
    state.value = snapshot(sonnet, "high")
    await nextTick()
    expect(preset.value).toEqual({ model: haiku, thinkingLevel: "low" })

    preset.value = { model: gpt, thinkingLevel: "off" }
    await nextTick()
    expect(setModel).toHaveBeenCalledTimes(1)
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })

    releases.shift()?.()
    await new Promise((resolve) => setTimeout(resolve))
    expect(setModel).toHaveBeenCalledTimes(2)
    expect(setModel).toHaveBeenNthCalledWith(2, gpt)

    releases.shift()?.()
    await new Promise((resolve) => setTimeout(resolve))
    expect(setThinking).toHaveBeenCalledTimes(1)
    expect(setThinking).toHaveBeenCalledWith("off")
    expect(preset.value).toEqual({ model: gpt, thinkingLevel: "off" })
  })

  it("setModel 失败时清理 pending 并回落到当前快照模型", async () => {
    const state = ref(snapshot({ provider: "a", id: "one" }, "high"))
    const setModel = vi.fn(async () => {
      throw new Error("boom")
    })
    const setThinking = vi.fn(async () => undefined)
    const { preset } = useComposerBinding({
      catalog: ref(catalog),
      defaultModel: ref(null),
      snapshot: state,
      phase: ref("idle"),
      setModel,
      setThinking,
    })

    preset.value = { model: { provider: "b", id: "two" }, thinkingLevel: "low" }
    await new Promise((resolve) => setTimeout(resolve))
    expect(setModel).toHaveBeenCalledTimes(1)
    expect(setThinking).not.toHaveBeenCalled()
    expect(preset.value).toEqual({ model: { provider: "a", id: "one" }, thinkingLevel: "high" })
  })
})
