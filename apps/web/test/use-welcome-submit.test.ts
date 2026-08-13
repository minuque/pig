import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { ComposerPreset } from "@components/composer/types.js";
import type { LocalWorkspace } from "@features/sessions/types.js";
import {
  nextWelcomeWorkspaceId,
  useWelcomeSubmit,
} from "@features/sessions/hooks/use-welcome-submit.js";

function workspace(id: string): LocalWorkspace {
  return { canonicalPath: `/${id}` };
}
const preset: ComposerPreset = {
  model: { provider: "openai", id: "gpt-5" },
  thinkingLevel: "high",
};

describe("nextWelcomeWorkspaceId", () => {
  it("keeps the current selection while it still exists", () => {
    expect(nextWelcomeWorkspaceId([workspace("a"), workspace("b")], "/b", undefined)).toBe("/b");
  });

  it("falls back to the last cwd, then the first workspace", () => {
    expect(nextWelcomeWorkspaceId([workspace("a"), workspace("b")], undefined, "/b")).toBe("/b");
    expect(nextWelcomeWorkspaceId([workspace("a"), workspace("b")], "/gone", "/gone")).toBe("/a");
    expect(nextWelcomeWorkspaceId([workspace("a")], undefined, undefined)).toBe("/a");
  });

  it("returns undefined for an empty list", () => {
    expect(nextWelcomeWorkspaceId([], "/a", undefined)).toBeUndefined();
  });
});

describe("useWelcomeSubmit", () => {
  it("creates a session, sends the first input and clears the prompt", async () => {
    const workspaces = ref([workspace("a")]);
    const lastCwd = ref<string | undefined>(undefined);
    const createSession = vi.fn(async () => undefined);
    const submit = vi.fn(async () => undefined);
    const { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, submitWelcome } =
      useWelcomeSubmit({
        workspaces,
        lastCwd,
        preset: ref(preset),
        createSession,
        submit,
      });

    await nextTick(); // immediate watch 落到首个 Workspace
    expect(welcomeWorkspaceId.value).toBe("/a");
    welcomePrompt.value = "任务";
    await submitWelcome("  任务  ");

    expect(createSession).toHaveBeenCalledWith("/a");
    expect(submit).toHaveBeenCalledWith("任务");
    expect(welcomePrompt.value).toBe("");
    expect(welcomeSubmitting.value).toBe(false);
  });

  it("reports the error when creation fails", async () => {
    const workspaces = ref([workspace("a")]);
    const lastCwd = ref<string | undefined>(undefined);
    const createSession = vi.fn(async () => {
      throw new Error("创建失败");
    });
    const submit = vi.fn(async () => undefined);
    const { welcomeError, submitWelcome } = useWelcomeSubmit({
      workspaces,
      lastCwd,
      preset: ref(preset),
      createSession,
      submit,
    });

    await nextTick();
    await submitWelcome("任务");

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(welcomeError.value).toBe("创建失败");
  });

  it("ignores blank input or a missing preset", async () => {
    const workspaces = ref([workspace("a")]);
    const lastCwd = ref<string | undefined>(undefined);
    const createSession = vi.fn(async () => undefined);
    const submit = vi.fn(async () => undefined);
    const { welcomeSubmitting, submitWelcome } = useWelcomeSubmit({
      workspaces,
      lastCwd,
      preset: ref(undefined),
      createSession,
      submit,
    });

    await nextTick();
    await submitWelcome("   "); // 空白输入
    await submitWelcome("任务"); // 无 preset

    expect(createSession).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(welcomeSubmitting.value).toBe(false);
  });
});
