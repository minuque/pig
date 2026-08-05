import { nextTick, ref, watch, type Ref } from "vue";
import type { ModelPreset } from "@no-pi-no-gang/contracts";
import type { SessionDto, WorkspaceDto } from "../api/index.js";

/** 当前选择仍存在于列表时保留，否则回退到第一个 Workspace。 */
export function nextWelcomeWorkspaceId(
  workspaces: WorkspaceDto[],
  current: string | undefined,
): string | undefined {
  return workspaces.some(({ id }) => id === current) ? current : workspaces[0]?.id;
}

export interface WelcomeSubmitDeps {
  workspaces: Ref<WorkspaceDto[]>;
  preset: Ref<ModelPreset | undefined>;
  sessionErrors: Ref<Map<string, string>>;
  prompt: Ref<string>;
  createSession: (workspaceId: string) => Promise<SessionDto | undefined>;
  sendPrompt: () => Promise<void>;
}

/** 欢迎页首次提交编排：创建 Session → 发送首条 Run → 清空输入。 */
export function useWelcomeSubmit(deps: WelcomeSubmitDeps) {
  const welcomePrompt = ref("");
  const welcomeWorkspaceId = ref<string>();
  const welcomeSubmitting = ref(false);
  const welcomeError = ref("");

  watch(
    deps.workspaces,
    (items) => {
      welcomeWorkspaceId.value = nextWelcomeWorkspaceId(items, welcomeWorkspaceId.value);
    },
    { immediate: true },
  );
  async function submitWelcome(text: string) {
    const workspaceId = welcomeWorkspaceId.value;
    const trimmed = text.trim();
    if (!workspaceId || !deps.preset.value || !trimmed || welcomeSubmitting.value) return;
    welcomeSubmitting.value = true;
    welcomeError.value = "";
    try {
      const session = await deps.createSession(workspaceId);
      if (!session) {
        welcomeError.value = deps.sessionErrors.value.get(workspaceId) || "无法创建 Session";
        return;
      }
      // 等路由切换到新 Session 后 prompt 才指向它，随后发送首条 Run
      await nextTick();
      deps.prompt.value = trimmed;
      await deps.sendPrompt();
      welcomePrompt.value = "";
    } finally {
      welcomeSubmitting.value = false;
    }
  }
  return { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, welcomeError, submitWelcome };
}
