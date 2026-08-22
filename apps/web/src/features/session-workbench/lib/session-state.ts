import { reactive } from "vue";
import type {
  ModelRef,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
} from "@earendil-works/pi-protocol";
import type { MarkstreamThreadVirtualState } from "markstream-vue";
import { UNTITLED_SESSION } from "@features/session-nav/format.js";

/** 每 Session 的 UI 私有状态（草稿、滚动位置恢复），不进入任何 Agent Domain。 */
export interface SessionClientState {
  draft: string;
  /** 上次离开会话时的虚拟滚动状态（滚动锚点 + 行高缓存），切回时恢复 */
  threadState: MarkstreamThreadVirtualState | null;
}

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  let state = states.get(sessionId);
  if (!state) {
    // reactive：draft/threadState 等属性写入必须被响应式追踪（如 draft 清空后 PromptEditor 同步）
    state = reactive({ draft: "", threadState: null });
    states.set(sessionId, state);
  }
  return state;
}

/** 路由已指向某 Session，但 RemoteSession 尚未附加到同一 id。 */
export function isSessionPending(
  routeSessionId: string | undefined,
  attachedSessionId: string | undefined,
): boolean {
  return routeSessionId !== undefined && routeSessionId !== attachedSessionId;
}

/** SessionSnapshot 的 UI 展示投影：以快照为权威，重连后整体覆盖，不增量修补。 */
export interface SessionProjection {
  id: string;
  name: string;
  cwd: string;
  model: ModelRef;
  thinkingLevel: ThinkingLevel;
  phase: SessionPhase;
  running: boolean;
  queuedSteerCount: number;
  updatedAt: number;
}

export function projectSessionSnapshot(snapshot: SessionSnapshot): SessionProjection {
  return {
    id: snapshot.id,
    name: snapshot.name?.trim() || UNTITLED_SESSION,
    cwd: snapshot.cwd,
    model: snapshot.model,
    thinkingLevel: snapshot.thinkingLevel,
    phase: snapshot.phase,
    running: snapshot.phase !== "idle",
    queuedSteerCount: snapshot.queuedSteerCount,
    updatedAt: snapshot.updatedAt,
  };
}

/** 打开会话与「显示更早」共用的页大小。与 gateway TRANSCRIPT_PAGE_SIZE 对齐。 */
export const INITIAL_TRANSCRIPT_TAIL = 40;

/** 取 transcript 尾部。不超过 limit 时原样返回，超过则丢掉头部、保持原顺序。 */
export function tailTranscript<T>(items: readonly T[], limit = INITIAL_TRANSCRIPT_TAIL): T[] {
  if (items.length <= limit) return items as T[];
  return items.slice(-limit);
}

/** 快照窗口覆盖已加载前缀中的同 id；前缀里被挤出窗口的条目保留。 */
export function mergeTranscriptWindow<T extends { id: string }>(
  prefix: readonly T[],
  window: readonly T[],
): T[] {
  const inWindow = new Set(window.map((item) => item.id));
  return [...prefix.filter((item) => !inWindow.has(item.id)), ...window];
}

/** 还有更早消息可加载：未耗尽，且全量大于已加载（全量未知时满页则显示按钮）。 */
export function hasEarlierTranscript(
  loaded: number,
  total: number | undefined,
  exhausted: boolean,
  page = INITIAL_TRANSCRIPT_TAIL,
): boolean {
  if (exhausted || loaded === 0) return false;
  if (total !== undefined) return total > loaded;
  return loaded >= page;
}
