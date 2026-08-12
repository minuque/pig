import { computed, shallowRef, toValue, type MaybeRefOrGetter } from "vue";
import type { PiClient, Unsubscribe } from "@earendil-works/pi-client";
import { RemoteSession } from "@earendil-works/pi-coding-agent/client";
import type {
  RemoteSessionLifecycle,
  RemoteSessionState,
} from "@earendil-works/pi-coding-agent/client";
import type { ModelRef, ThinkingLevel } from "@earendil-works/pi-protocol";
import { projectSessionSnapshot, type SessionProjection } from "./session-state.js";
import { projectTranscript, type TranscriptPart } from "./transcript-format.js";

export type { SessionGroup } from "./types.js";

export interface CreateSessionInput {
  cwd: string;
  model?: ModelRef;
  thinkingLevel?: ThinkingLevel;
}

/**
 * 围绕官方 RemoteSession 的组合式状态：
 * create/open 附加会话，submit/abort/setModel/setThinking 转发官方实例，
 * Snapshot/Transcript 经 RemoteSessionState 投影为 UI 可读视图。
 * SDK 实例用 shallowRef 保存（不深追踪），纯派生用 computed。
 */
export function useRemoteSessions(clientSource: MaybeRefOrGetter<PiClient | undefined>) {
  const client = computed(() => toValue(clientSource));
  // SDK 实例仅存引用，不响应式深追踪
  const remote = shallowRef<RemoteSession>();
  const state = shallowRef<RemoteSessionState>();
  const lastError = shallowRef<Error>();
  let unsubscribeState: Unsubscribe | undefined;
  let disposePromise: Promise<void> | undefined;
  // 替换操作串行化：同一时刻至多一个 open/create，避免并发 lease
  let replaceChain: Promise<void> = Promise.resolve();

  // 纯派生：由上述状态 computed 得到
  const lifecycle = computed<RemoteSessionLifecycle | undefined>(() => state.value?.lifecycle);
  const busy = computed(() => lifecycle.value?.status === "busy");
  const operation = computed(() =>
    lifecycle.value?.status === "busy" ? lifecycle.value.operation : undefined,
  );
  const snapshot = computed(() => state.value?.snapshot);
  const projection = computed<SessionProjection | undefined>(() =>
    snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined,
  );
  const transcript = computed(() => state.value?.transcript ?? []);
  const transcriptParts = computed<TranscriptPart[]>(() => projectTranscript(transcript.value));

  function attach(next: RemoteSession) {
    const previous = remote.value;
    detach();
    // 替换旧实例：释放其 lease（RemoteSession.dispose 幂等，可重复调用）
    if (previous && previous !== next) void previous.dispose();
    remote.value = next;
    unsubscribeState = next.subscribe((nextState) => {
      state.value = nextState;
    });
  }
  function detach() {
    unsubscribeState?.();
    unsubscribeState = undefined;
    remote.value = undefined;
    state.value = undefined;
  }

  /** 串行执行替换操作：前一次失败不阻塞后续。 */
  function enqueueReplace<T>(run: () => Promise<T>): Promise<T> {
    const next = replaceChain.then(run, run);
    replaceChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /** 打开已有 Session：重连后以官方 Snapshot 整体覆盖本地投影。已附加同 id 时幂等跳过。 */
  async function openSession(sessionId: string) {
    return enqueueReplace(async () => {
      if (remote.value?.id === sessionId) return;
      const target = client.value;
      if (!target) throw new Error("PiClient 未连接");
      try {
        attach(await RemoteSession.open(target, sessionId));
      } catch (error) {
        lastError.value = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    });
  }

  /** 在指定 cwd 创建新 Session（cwd 来自本地 Workspace preference）。 */
  async function createSession(cwd: string, options?: Omit<CreateSessionInput, "cwd">) {
    return enqueueReplace(async () => {
      const target = client.value;
      if (!target) throw new Error("PiClient 未连接");
      try {
        attach(
          await RemoteSession.create(target, {
            cwd,
            ...(options?.model !== undefined ? { model: options.model } : {}),
            ...(options?.thinkingLevel !== undefined
              ? { thinkingLevel: options.thinkingLevel }
              : {}),
          }),
        );
      } catch (error) {
        lastError.value = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    });
  }

  /** 等待已附加的 RemoteSession 进入 ready：供创建后立刻提交首条输入。 */
  async function whenReady(): Promise<void> {
    const current = remote.value;
    if (!current) throw new Error("Session 未附加");
    if (current.state.lifecycle.status === "ready") return;
    await new Promise<void>((resolve, reject) => {
      const unsubscribe = current.subscribe((nextState) => {
        if (nextState.lifecycle.status === "ready") {
          unsubscribe();
          resolve();
        } else if (nextState.lifecycle.status === "disposed") {
          unsubscribe();
          reject(new Error("Session 已销毁"));
        }
      });
    });
  }

  /** 提交输入：idle 时 prompt，turn 时 steer，由官方 RemoteSession 决定。 */
  async function submit(text: string) {
    await remote.value?.submit(text);
  }
  async function abort() {
    await remote.value?.abort();
  }
  async function setModel(model: ModelRef) {
    await remote.value?.setModel(model);
  }
  async function setThinking(thinkingLevel: ThinkingLevel) {
    await remote.value?.setThinking(thinkingLevel);
  }
  async function reconnect() {
    await remote.value?.reconnect();
  }
  async function dispose() {
    if (disposePromise) return disposePromise;
    const current = remote.value;
    detach();
    disposePromise = current?.dispose() ?? Promise.resolve();
    return disposePromise;
  }

  return {
    remote,
    state,
    lastError,
    lifecycle,
    busy,
    operation,
    snapshot,
    projection,
    transcript,
    transcriptParts,
    openSession,
    createSession,
    whenReady,
    submit,
    abort,
    setModel,
    setThinking,
    reconnect,
    dispose,
  };
}
