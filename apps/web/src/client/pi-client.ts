/**
 * PiClient 连接管理（Browser platform）。
 * 官方 PiClient 是唯一连接入口：重连、Session 列表、模型目录由官方协议负责，
 * 本模块只做实例生命周期与 Vue 响应式投影。
 * SDK 实例用 shallowRef 保存（不深追踪），纯派生用 computed。
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { PiClient } from "@earendil-works/pi-client";
import type { ConnectionState, Unsubscribe } from "@earendil-works/pi-client";
import type { ServerSnapshot } from "@earendil-works/pi-protocol";
import { restoreCredential } from "@client/bootstrap.js";
import { createWebSocketByteTransportFactory, webSocketUrl } from "@client/transport.js";

export interface PiClientConnectionOptions {
  /** 覆盖默认的本机 WebSocket URL（含认证）。 */
  url?: string;
  maxFrameLength?: number;
}

const RECONNECT_ATTEMPTS = 5;

export function usePiClient() {
  // SDK 实例仅存引用，不响应式深追踪
  const client = shallowRef<PiClient>();
  const serverSnapshot = shallowRef<ServerSnapshot>();
  const connectionState = ref<ConnectionState>("disconnected");
  const connectionError = shallowRef<Error>();
  let unsubscribes: Unsubscribe[] = [];
  let disposed = false;
  let attachedReconnect: (() => Promise<void>) | undefined;
  let wasConnected = false;
  let reconnecting = false;

  function bindAttachedReconnect(fn?: () => Promise<void>) {
    attachedReconnect = fn;
  }

  // 纯派生：由上述状态 computed 得到
  const connected = computed(() => connectionState.value === "connected");
  const sessions = computed(() => serverSnapshot.value?.sessions ?? []);
  const models = computed(() => serverSnapshot.value?.models ?? []);

  function unsubscribeAll() {
    for (const unsubscribe of unsubscribes) unsubscribe();
    unsubscribes = [];
  }

  /** 创建新连接：先脱离旧实例并断开，避免旧回调污染新连接状态。 */
  async function connect(options: PiClientConnectionOptions = {}): Promise<PiClient> {
    if (disposed) throw new Error("usePiClient 已销毁");
    const previous = client.value;
    unsubscribeAll();
    await previous?.dispose();
    connectionError.value = undefined;

    const next = new PiClient({
      transportFactory: createWebSocketByteTransportFactory({
        url: options.url ?? webSocketUrl(restoreCredential()),
      }),
      ...(options.maxFrameLength !== undefined ? { maxFrameLength: options.maxFrameLength } : {}),
      onListenerError: (error) => {
        connectionError.value = error;
      },
    });
    client.value = next;
    unsubscribes.push(
      next.onConnectionStateChange((change) => {
        connectionState.value = change.state;
        if (change.error) connectionError.value = change.error;
      }),
      next.subscribe((snapshot) => {
        serverSnapshot.value = snapshot;
      }),
    );
    try {
      serverSnapshot.value = await next.connect();
    } catch (error) {
      connectionError.value = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
    return next;
  }

  /** 用官方 list 结果覆盖快照里的 sessions，不另建列表。 */
  async function refreshSessions() {
    const current = client.value;
    const snapshot = serverSnapshot.value;
    if (!current || !snapshot) return;
    const sessions = await current.listSessions();
    serverSnapshot.value = { ...snapshot, sessions: [...sessions] };
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    const current = client.value;
    unsubscribeAll();
    client.value = undefined;
    connectionState.value = "disconnected";
    serverSnapshot.value = undefined;
    await current?.dispose();
  }

  watch(connectionState, (state) => {
    if (state === "connected") {
      wasConnected = true;
      return;
    }
    if (state !== "disconnected" || !wasConnected || reconnecting || disposed) return;
    reconnecting = true;
    void (async () => {
      try {
        for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          if (disposed || connectionState.value === "connected") break;
          try {
            if (attachedReconnect) await attachedReconnect();
            else await client.value?.reconnect();
          } catch {
            // 继续退避；最终失败由 connectionError 呈现
          }
        }
      } finally {
        reconnecting = false;
      }
    })();
  });

  onBeforeUnmount(() => {
    void dispose();
  });

  return {
    client,
    connectionState,
    connectionError,
    connected,
    sessions,
    models,
    connect,
    refreshSessions,
    bindAttachedReconnect,
    dispose,
  };
}
