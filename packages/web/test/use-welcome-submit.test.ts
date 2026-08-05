import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { ModelPreset } from "@no-pi-no-gang/contracts";
import type { SessionDto, WorkspaceDto } from "../src/api/index.js";
import { nextWelcomeWorkspaceId, useWelcomeSubmit } from "../src/app/use-welcome-submit.js";

function workspace(id: string): WorkspaceDto {
  return { id, name: id, canonicalPath: `/${id}` };
}
function session(id: string, workspaceId: string): SessionDto {
  return { id, workspaceId, status: "available", updatedAt: "now" };
}
const preset: ModelPreset = { model: "gpt-5", thinkingLevel: "high" };

describe("nextWelcomeWorkspaceId", () => {
  it("keeps the current selection while it still exists", () => {
    expect(nextWelcomeWorkspaceId([workspace("a"), workspace("b")], "b")).toBe("b");
  });

  it("falls back to the first workspace when the selection is gone or absent", () => {
    expect(nextWelcomeWorkspaceId([workspace("a"), workspace("b")], "gone")).toBe("a");
    expect(nextWelcomeWorkspaceId([workspace("a")], undefined)).toBe("a");
  });

  it("returns undefined for an empty list", () => {
    expect(nextWelcomeWorkspaceId([], "a")).toBeUndefined();
  });
});

describe("useWelcomeSubmit", () => {
  it("creates a session, sends the first run and clears the input", async () => {
    const workspaces = ref([workspace("a")]);
    const sessionErrors = ref(new Map<string, string>());
    const prompt = ref("");
    const createSession = vi.fn(async () => session("s1", "a"));
    const sendPrompt = vi.fn(async () => undefined);
    const { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, submitWelcome } =
      useWelcomeSubmit({
        workspaces,
        preset: ref(preset),
        sessionErrors,
        prompt,
        createSession,
        sendPrompt,
      });

    await nextTick(); // immediate watch 落到首个 Workspace
    expect(welcomeWorkspaceId.value).toBe("a");
    welcomePrompt.value = "任务";
    await submitWelcome("  任务  ");

    expect(createSession).toHaveBeenCalledWith("a");
    expect(prompt.value).toBe("任务");
    expect(sendPrompt).toHaveBeenCalledTimes(1);
    expect(welcomePrompt.value).toBe("");
    expect(welcomeSubmitting.value).toBe(false);
  });

  it("reports the session error when creation fails", async () => {
    const workspaces = ref([workspace("a")]);
    const sessionErrors = ref(new Map([["a", "boom"]]));
    const createSession = vi.fn(async () => undefined);
    const sendPrompt = vi.fn(async () => undefined);
    const { welcomeSubmitting, welcomeError, submitWelcome } = useWelcomeSubmit({
      workspaces,
      preset: ref(preset),
      sessionErrors,
      prompt: ref(""),
      createSession,
      sendPrompt,
    });

    await nextTick();
    await submitWelcome("任务");

    expect(welcomeError.value).toBe("boom");
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(welcomeSubmitting.value).toBe(false);
  });

  it("ignores blank input or a missing preset", async () => {
    const workspaces = ref([workspace("a")]);
    const createSession = vi.fn(async () => session("s1", "a"));
    const sendPrompt = vi.fn(async () => undefined);
    const { submitWelcome } = useWelcomeSubmit({
      workspaces,
      preset: ref(undefined),
      sessionErrors: ref(new Map()),
      prompt: ref(""),
      createSession,
      sendPrompt,
    });

    await nextTick();
    await submitWelcome("   ");
    await submitWelcome("任务");

    expect(createSession).not.toHaveBeenCalled();
    expect(sendPrompt).not.toHaveBeenCalled();
  });
});
