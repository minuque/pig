import { ref, watch, type Ref } from "vue";
import type { ChatInputPreset } from "@features/chat-input/types.js";

/** 当前选择仍存在于列表时保留，否则回退到最近使用的目录或第一个目录。 */
export function nextWelcomeWorkspaceId(
  workspaces: readonly string[],
  current: string | undefined,
  lastCwd: string | undefined,
): string | undefined {
  if (workspaces.includes(current ?? "")) return current;
  if (lastCwd !== undefined && workspaces.includes(lastCwd)) return lastCwd;
  return workspaces[0];
}

export interface WelcomeSubmitDeps {
  workspaces: Ref<readonly string[]>;
  lastCwd: Ref<string | undefined>;
  preset: Ref<ChatInputPreset | undefined>;
  createSession: (cwd: string) => Promise<void>;
  submit: (text: string) => Promise<void>;
}

/** 欢迎页首次提交编排：创建 Session（推路由并附加）→ 等 ready → 发送首条输入。 */
export function useWelcomeSubmit(deps: WelcomeSubmitDeps) {
  const welcomePrompt = ref("");
  const welcomeWorkspaceId = ref<string>();
  const welcomeSubmitting = ref(false);
  const welcomeError = ref("");

  watch(
    [deps.workspaces, deps.lastCwd],
    ([items, last]) => {
      welcomeWorkspaceId.value = nextWelcomeWorkspaceId(items, welcomeWorkspaceId.value, last);
    },
    { immediate: true },
  );
  async function submitWelcome(text: string) {
    const cwd = welcomeWorkspaceId.value;
    const trimmed = text.trim();
    if (!cwd || !deps.preset.value || !trimmed || welcomeSubmitting.value) return;
    welcomeSubmitting.value = true;
    welcomeError.value = "";
    try {
      await deps.createSession(cwd);
      await deps.submit(trimmed);
      welcomePrompt.value = "";
    } catch (error) {
      welcomeError.value = error instanceof Error ? error.message : String(error);
    } finally {
      welcomeSubmitting.value = false;
    }
  }
  return { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, welcomeError, submitWelcome };
}
