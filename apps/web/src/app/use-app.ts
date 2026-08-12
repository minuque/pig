import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { bootstrapFromUrl, errorMessage, platformRequest } from "../client/http.js";
import { usePiClient } from "../client/pi-client.js";
import { useLocalWorkspaces } from "../client/workspace.js";
import { useRemoteSessions } from "../features/sessions/use-sessions.js";
import {
  sessionState,
  type SessionClientState,
  type TranscriptScrollState,
} from "../features/sessions/session-state.js";
import {
  groupSessionsByCwd,
  localWorkspacesFrom,
  workspaceName,
} from "../features/sessions/types.js";
import {
  catalogFromModels,
  defaultPresetFrom,
  modelRefOf,
  thinkingLevelOf,
  type ComposerPreset,
} from "../components/composer/types.js";

const RECONNECT_ATTEMPTS = 5;

export function useApp() {
  const route = useRoute();
  const router = useRouter();
  const startupError = ref("");
  const sessionError = ref("");
  const aborting = ref(false);
  const creatingCwd = ref<string>();
  const addingWorkspace = ref(false);
  const preset = ref<ComposerPreset>();
  // 每 Session 的 UI 私有状态（草稿/滚动/跟随）；reactive 保证属性写入可被追踪
  const states = reactive(new Map<string, SessionClientState>());

  /* ── 官方远程栈接线 ─────────────────────────────────────────── */
  const pi = usePiClient();
  const local = useLocalWorkspaces();
  const remote = useRemoteSessions(pi.client);

  const sessionId = computed(() => {
    const raw = route.params.sessionId;
    return typeof raw === "string" && raw.length > 0 ? raw : undefined;
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

  // 快照权威：快照的 model/thinkingLevel 变化时镜像到 preset（字符串值比较，
  // 用户尚未生效的选择不被覆盖；setModel 成功回执后快照更新再同步）
  watch(
    [() => snapshotModelKey(remote.snapshot.value), () => remote.snapshot.value?.thinkingLevel],
    ([modelKey, level]) => {
      if (modelKey && level) {
        preset.value = { model: modelKey, thinkingLevel: level };
      }
    },
  );
  // 用户改动 preset：与快照不一致时下发官方 setModel/setThinking
  watch(preset, (next) => {
    const snapshot = remote.snapshot.value;
    if (!next || !snapshot) return;
    const key = `${snapshot.model.provider}/${snapshot.model.id}`;
    if (next.model !== key) {
      void remote
        .setModel(modelRefOf(next))
        .catch((error) => (sessionError.value = errorMessage(error)));
    } else if (next.thinkingLevel !== snapshot.thinkingLevel) {
      void remote
        .setThinking(thinkingLevelOf(next.thinkingLevel))
        .catch((error) => (sessionError.value = errorMessage(error)));
    }
  });
  // 目录加载后给出默认执行档（欢迎页无快照时使用）
  watch(
    catalog,
    (items) => {
      if (!preset.value && items.length) preset.value = defaultPresetFrom(items);
    },
    { immediate: true },
  );

  /* ── 会话打开/创建/提交 ─────────────────────────────────────── */
  let initialized = false;
  async function syncSession() {
    const id = sessionId.value;
    if (!id) {
      await remote.dispose();
      return;
    }
    try {
      await remote.openSession(id);
    } catch (error) {
      sessionError.value = errorMessage(error);
      // 未知 Session 深链回退欢迎页
      if (sessionId.value) await router.replace("/");
    }
  }
  watch(sessionId, () => {
    if (initialized) void syncSession();
  });

  async function createSession(cwd: string) {
    if (creatingCwd.value) return;
    creatingCwd.value = cwd;
    sessionError.value = "";
    try {
      const p = preset.value;
      await remote.createSession(
        cwd,
        p ? { model: modelRefOf(p), thinkingLevel: thinkingLevelOf(p.thinkingLevel) } : undefined,
      );
      local.selectCwd(cwd);
      const nextId = remote.remote.value?.id;
      if (nextId && nextId !== sessionId.value) {
        await router.push({ name: "session", params: { sessionId: nextId } });
      }
    } catch (error) {
      sessionError.value = errorMessage(error);
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
      // 发送成功才清空草稿：失败时正文与附件原样保留，可直接重试
      prompt.value = "";
    } catch (error) {
      sessionError.value = errorMessage(error);
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

  /* ── 本地目录 ───────────────────────────────────────────────── */
  async function addWorkspace() {
    if (addingWorkspace.value) return;
    addingWorkspace.value = true;
    sessionError.value = "";
    try {
      const { path } = await platformRequest<{ path: string | null }>(
        "/api/v1/platform/select-directory",
        { method: "POST" },
      );
      if (path) {
        local.add(path);
        local.selectCwd(path);
        expandCwd(path);
      }
    } catch (error) {
      sessionError.value = errorMessage(error);
    } finally {
      addingWorkspace.value = false;
    }
  }
  function revokeWorkspace(canonicalPath: string) {
    if (confirm(`从列表中移除 ${workspaceName(canonicalPath)}？`)) local.remove(canonicalPath);
  }

  /* ── 导航分组与展开态 ───────────────────────────────────────── */
  const localWorkspaces = computed(() => localWorkspacesFrom(local.workspaces.value));
  const groups = computed(() => groupSessionsByCwd(pi.sessions.value, local.workspaces.value));
  const expandedWorkspaceIds = ref(new Set<string>());
  function expandCwd(canonicalPath: string) {
    if (!expandedWorkspaceIds.value.has(canonicalPath))
      expandedWorkspaceIds.value = new Set([...expandedWorkspaceIds.value, canonicalPath]);
  }
  function toggleWorkspace(canonicalPath: string) {
    if (!expandedWorkspaceIds.value.has(canonicalPath)) {
      expandCwd(canonicalPath);
      return;
    }
    const next = new Set(expandedWorkspaceIds.value);
    next.delete(canonicalPath);
    expandedWorkspaceIds.value = next;
  }
  // 首次拿到目录分组时展开最近使用的目录
  watch(
    groups,
    (list) => {
      if (expandedWorkspaceIds.value.size || !list.length) return;
      const target = local.lastCwd.value ?? list[0]!.canonicalPath;
      if (list.some((group) => group.canonicalPath === target)) expandCwd(target);
    },
    { immediate: true },
  );

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
      initialized = true;
      await syncSession();
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
    // SessionNav 契约
    groups,
    workspaces: localWorkspaces,
    expandedWorkspaceIds,
    activeWorkspaceId: computed(() => projection.value?.cwd),
    activeSessionId: sessionId,
    activeSessionRunning: computed(() => projection.value?.running ?? false),
    // TranscriptView/ChatInput 契约
    sessionId,
    projection,
    phase: computed(() => projection.value?.phase),
    queuedSteerCount: computed(() => projection.value?.queuedSteerCount ?? 0),
    transcript,
    clientState,
    // 动作
    toggleWorkspace,
    addWorkspace,
    revokeWorkspace,
    createSession,
    submitText,
    abortSession,
    applyScrollState,
    lastCwd: local.lastCwd,
  };
}

function snapshotModelKey(snapshot: { model: { provider: string; id: string } } | undefined) {
  return snapshot ? `${snapshot.model.provider}/${snapshot.model.id}` : undefined;
}
