import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { Router } from "vue-router";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import type { ChatInputPreset } from "@features/chat-input/types.js";
import type { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js";
import { useSessionRuntime } from "@features/session-workbench/hooks/use-session-runtime.js";

function setup(submit: (text: string) => Promise<void>) {
  const transcript = ref<TranscriptItem[]>([
    {
      id: "u1",
      role: "user",
      content: [{ type: "text", text: "旧任务" }],
      timestamp: 1,
    },
  ]);
  const remote = {
    remote: ref({ id: "s1" }),
    transcript,
    submit: vi.fn(submit),
    createSession: vi.fn(),
    abort: vi.fn(),
  } as unknown as ReturnType<typeof useRemoteSessions>;
  const runtime = useSessionRuntime({
    remote,
    sessionId: ref("s1"),
    router: { push: vi.fn() } as unknown as Router,
    preset: ref<ChatInputPreset>(),
    sessionError: ref(""),
    selectCwd: vi.fn(),
  });
  return { remote, runtime };
}

describe("useSessionRuntime submitText", () => {
  it("提交时立即清空草稿并插入乐观用户句", async () => {
    let resolveSubmit = () => {};
    const pending = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const { remote, runtime } = setup(() => pending);
    runtime.prompt.value = "  新任务  ";

    const request = runtime.submitText(runtime.prompt.value);

    expect(runtime.prompt.value).toBe("");
    expect(runtime.clientState.value?.optimisticUser).toMatchObject({
      item: { role: "user", content: [{ type: "text", text: "新任务" }] },
      knownItemIds: ["u1"],
    });
    expect(remote.submit).toHaveBeenCalledWith("新任务");

    resolveSubmit();
    await request;
    expect(runtime.clientState.value?.optimisticUser).toBeNull();
  });

  it("提交失败时恢复未被新输入覆盖的草稿", async () => {
    const { runtime } = setup(async () => {
      throw new Error("发送失败");
    });
    runtime.prompt.value = "任务";

    await expect(runtime.submitText("任务")).rejects.toThrow("发送失败");

    expect(runtime.prompt.value).toBe("任务");
    expect(runtime.clientState.value?.optimisticUser).toBeNull();
  });
});
