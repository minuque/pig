import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { bootstrapFromUrl, errorMessage, platformRequest } from "@client/http.js";
import { usePiClient } from "@client/pi-client.js";
import { useLocalWorkspaces } from "@client/workspace.js";
import { catalogFromModels, thinkingLevelOf } from "@features/chat-input/types.js";
import { useChatInputBinding } from "@features/chat-input/hooks/use-chat-input-binding.js";
import { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js";
import { useSessionRoute } from "@features/session-workbench/hooks/use-session-route.js";
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js";
import {
  sessionState,
  type SessionClientState,
  type TranscriptScrollState,
} from "@features/session-workbench/session-state.js";

const RECONNECT_ATTEMPTS = 5;

export type Workspace = ReturnType<typeof createWorkspace>;
export const workspaceKey: InjectionKey<Workspace> = Symbol("workspace");

function createWorkspace() {
  const route = useRoute();
  const router = useRouter();
  const startupError = ref("");
  const sessionError = ref("");
  const aborting = ref(false);
  const creatingCwd = ref<string>();
  // 每 Session 的 UI 私有状态（草稿/滚动/跟随）；reactive 保证属性写入可被追踪
  const states = reactive(new Map<string, SessionClientState>());

  /* ── 官方远程栈接线 ─────────────────────────────────────────── */
  const pi = usePiClient();
  const local = useLocalWorkspaces();
  const remote = useRemoteSessions(pi.client);

  const { sessionId, initialize: initializeSessionRoute } = useSessionRoute({
    route,
    router,
    error: sessionError,
    errorMessage,
    openSession: remote.openSession,
    dispose: remote.dispose,
  });
  const projection = remote.projection;
  const catalog = computed(() => catalogFromModels(pi.models.value));
  const transcript = remote.transcript;
  const connected = pi.connected;
  const connecting = computed(() => pi.connectionState.value === "connecting");
  const connectionError = pi.connectionError;

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
  function applyScrollState(scroll: TranscriptScrollState) {
    const state = clientState.value;
    if (!state) return;
    state.scrollTop = scroll.scrollTop;
    state.following = scroll.following;
    state.hasNewActivity = scroll.hasNewActivity;
  }

  const phase = computed(() => projection.value?.phase);
  const { preset } = useChatInputBinding({
    catalog,
    snapshot: remote.snapshot,
    phase,
    error: sessionError,
    setModel: remote.setModel,
    setThinking: remote.setThinking,
  });

  /* ── 会话创建/提交 ─────────────────────────────────────────── */
  async function createSession(cwd: string) {
    if (creatingCwd.value) return;
    creatingCwd.value = cwd;
    sessionError.value = "";
    try {
      const p = preset.value;
      await remote.createSession(
        cwd,
        p ? { model: p.model, thinkingLevel: thinkingLevelOf(p.thinkingLevel) } : undefined,
      );
      local.selectCwd(cwd);
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
  const submitting = ref(false);
  async function submitText(text: string) {
    if (submitting.value) return;
    submitting.value = true;
    sessionError.value = "";
    try {
      await remote.submit(text);
      // 发送成功才清空草稿；失败时正文保留，可直接重试
      prompt.value = "";
    } catch (error) {
      sessionError.value = errorMessage(error);
      throw error;
    } finally {
      submitting.value = false;
    }
  }
  async function renameSession(id: string, name: string) {
    sessionError.value = "";
    try {
      await platformRequest("/api/v1/platform/rename-session", {
        method: "POST",
        body: JSON.stringify({ id, name }),
      });
      await pi.refreshSessions();
    } catch (error) {
      sessionError.value = errorMessage(error);
    }
  }
  async function deleteSession(id: string) {
    sessionError.value = "";
    try {
      await platformRequest("/api/v1/platform/delete-session", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      if (sessionId.value === id) await router.replace("/");
      await pi.refreshSessions();
    } catch (error) {
      sessionError.value = errorMessage(error);
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

  const {
    addingWorkspace,
    workspaces,
    groups,
    expandedWorkspaceIds,
    toggleWorkspace,
    addWorkspace,
    revokeWorkspace,
  } = useWorkspaceNav(pi.sessions, local, sessionError);

  /* ── 连接生命周期：bootstrap → connect → 路由会话；断线退避重连（single-flight） ── */
  let wasConnected = false;
  let reconnecting = false;
  watch(pi.connectionState, (state) => {
    if (state === "connected") {
      wasConnected = true;
      return;
    }
    if (state !== "disconnected" || !wasConnected || reconnecting) return;
    reconnecting = true;
    void (async () => {
      try {
        for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          if (pi.connectionState.value === "connected") break;
          try {
            // 已附加 Session 时只经 remote 重连（内部 client.reconnect + 重新 acquire）；
            // 无 Session 时仅重连 client 刷新列表
            if (remote.remote.value) await remote.reconnect();
            else await pi.client.value?.reconnect();
          } catch {
            // 继续退避；最终失败由 connectionError 呈现
          }
        }
      } finally {
        reconnecting = false;
      }
    })();
  });

  onMounted(async () => {
    try {
      await bootstrapFromUrl();
      await pi.connect();
      await initializeSessionRoute();
    } catch (error) {
      startupError.value = errorMessage(error);
    }
  });
  onBeforeUnmount(() => {
    void remote.dispose();
  });

  return {
    startupError,
    sessionError,
    aborting,
    creating: creatingCwd,
    addingWorkspace,
    preset,
    prompt,
    catalog,
    connected,
    connecting,
    connectionError,
    groups,
    workspaces,
    expandedWorkspaceIds,
    activeWorkspaceId: computed(() => projection.value?.cwd),
    activeSessionId: sessionId,
    activeSessionRunning: computed(() => projection.value?.running ?? false),
    sessionId,
    projection,
    phase,
    queuedSteerCount: computed(() => projection.value?.queuedSteerCount ?? 0),
    transcript,
    clientState,
    toggleWorkspace,
    addWorkspace,
    revokeWorkspace,
    createSession,
    renameSession,
    deleteSession,
    submitText,
    abortSession,
    applyScrollState,
    lastCwd: local.lastCwd,
  };
}

/** 入口提供一次：侧栏与路由页通过 useWorkspace() 取同一份工作区。 */
export function provideWorkspace() {
  const workspace = createWorkspace();
  provide(workspaceKey, workspace);
  return workspace;
}

export function useWorkspace(): Workspace {
  const workspace = inject(workspaceKey);
  if (!workspace) throw new Error("useWorkspace() 需要在 provideWorkspace() 之后调用");
  return workspace;
}
