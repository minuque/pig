import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { SessionSnapshot } from "@earendil-works/pi-protocol";
import { useComposerBinding } from "@components/composer/hooks/use-composer-binding.js";
import type { ComposerVendor } from "@components/composer/types.js";

const catalog: ComposerVendor[] = [
  { id: "a", name: "A", models: [{ id: "one", name: "One", thinkingLevels: ["high"] }] },
  { id: "b", name: "B", models: [{ id: "two", name: "Two", thinkingLevels: ["low"] }] },
];

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
  } as SessionSnapshot;
}

describe("useComposerBinding", () => {
  it("切换模型时保留自动修正的 thinking，并在模型回执后下发", async () => {
    const state = ref(snapshot());
    let release!: () => void;
    const setModel = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          release = () => {
            state.value = snapshot({ provider: "b", id: "two" }, "high");
            resolve();
          };
        }),
    );
    const setThinking = vi.fn(async (level: string) => {
      state.value = snapshot({ provider: "b", id: "two" }, level);
    });
    const phase = ref<"idle" | undefined>("idle");
    const { preset } = useComposerBinding({
      catalog: ref(catalog),
      snapshot: state,
      phase,
      error: ref(""),
      setModel,
      setThinking,
    });

    state.value = snapshot();
    await nextTick();
    preset.value = { model: { provider: "b", id: "two" }, thinkingLevel: "low" };
    await nextTick();
    expect(setModel).toHaveBeenCalledWith({ provider: "b", id: "two" });
    expect(preset.value?.thinkingLevel).toBe("low");

    release();
    await new Promise((resolve) => setTimeout(resolve));
    expect(setThinking).toHaveBeenCalledWith("low");
    expect(preset.value).toEqual({ model: { provider: "b", id: "two" }, thinkingLevel: "low" });
  });
});
