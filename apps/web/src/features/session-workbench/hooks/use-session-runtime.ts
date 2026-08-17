import { computed, reactive, ref, type Ref } from "vue";
import type { Router } from "vue-router";
import type { MarkstreamThreadVirtualState } from "markstream-vue";
import { errorMessage } from "@client/http.js";
import { thinkingLevelOf, type ChatInputPreset } from "@features/chat-input/types.js";
import {
  sessionState,
  type SessionClientState,
} from "@features/session-workbench/lib/session-state.js";
import type { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js";

interface SessionRuntimeOptions {
  remote: ReturnType<typeof useRemoteSessions>;
  sessionId: Ref<string | undefined>;
  router: Router;
  preset: Ref<ChatInputPreset | undefined>;
  sessionError: Ref<string>;
  selectCwd(cwd: string): void;
}

/** 当前 Session 的 UI 运行时：草稿/滚动、创建/发送/中止。 */
export function useSessionRuntime(options: SessionRuntimeOptions) {
  const { remote, sessionId, router, preset, sessionError, selectCwd } = options;
  const states = reactive(new Map<string, SessionClientState>());
  const creatingCwd = ref<string>();
  const submitting = ref(false);
  const aborting = ref(false);

  const clientState = computed(() => {
    const id = sessionId.value;
    return id ? sessionState(states, id) : undefined;
  });
  const prompt = computed({
    get: () => clientState.value?.draft ?? "",
    set: (value: string) => {
      if (clientState.value) clientState.value.draft = value;
    },
  });

  function applyThreadState(threadState: MarkstreamThreadVirtualState) {
    const state = clientState.value;
    if (!state) return;
    state.threadState = threadState;
  }

  async function createSession(cwd: string) {
    if (creatingCwd.value) return;
    creatingCwd.value = cwd;
    sessionError.value = "";
    try {
      const next = preset.value;
      await remote.createSession(
        cwd,
        next
          ? { model: next.model, thinkingLevel: thinkingLevelOf(next.thinkingLevel) }
          : undefined,
      );
      selectCwd(cwd);
      const nextId = remote.remote.value?.id;
      if (nextId && nextId !== sessionId.value) {
        await router.push({ name: "session", params: { sessionId: nextId } });
      }
    } catch (error) {
      sessionError.value = errorMessage(error);
      throw error;
    } finally {
      creatingCwd.value = undefined;
    }
  }

  async function submitText(text: string) {
    if (submitting.value) return;
    submitting.value = true;
    sessionError.value = "";
    try {
      await remote.submit(text);
      prompt.value = "";
    } catch (error) {
      sessionError.value = errorMessage(error);
      throw error;
    } finally {
      submitting.value = false;
    }
  }

  async function abortSession() {
    if (aborting.value) return;
    aborting.value = true;
    try {
      await remote.abort();
    } catch (error) {
      sessionError.value = errorMessage(error);
    } finally {
      aborting.value = false;
    }
  }

  return {
    creating: creatingCwd,
    aborting,
    clientState,
    prompt,
    applyThreadState,
    createSession,
    submitText,
    abortSession,
  };
}
