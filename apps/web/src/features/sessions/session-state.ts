import { reactive } from "vue";
import type {
  ModelRef,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
} from "@earendil-works/pi-protocol";
import { projectTranscript, type TranscriptPart } from "./transcript-format.js";

export const clampPanelWidth = (width: number) => Math.min(420, Math.max(240, width));

export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = 80,
) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/** 每 Session 的 UI 私有状态（草稿、滚动、跟随），不进入任何 Agent Domain。 */
export interface SessionClientState {
  draft: string;
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
}

// TranscriptView 通过该类型化契约上报滚动状态，唯一所有者（App 层）负责写入
// SessionClientState 对应字段；TranscriptView 只读 props、只发事件
export interface TranscriptScrollState {
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
}

// 由滚动事件推导快照：贴底视为跟随并清除新活动提示，否则保留原提示
export function scrollStateFrom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  previousHasNewActivity: boolean,
): TranscriptScrollState {
  const following = isNearBottom(scrollTop, clientHeight, scrollHeight);
  return { scrollTop, following, hasNewActivity: following ? false : previousHasNewActivity };
}

export const sessionKey = (sessionId: string) => sessionId;

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  const key = sessionKey(sessionId);
  let state = states.get(key);
  if (!state) {
    // reactive：draft/滚动等属性写入必须被响应式追踪（如 draft 清空后 PromptEditor 同步）
    state = reactive({ draft: "", scrollTop: 0, following: true, hasNewActivity: false });
    states.set(key, state);
  }
  return state;
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
  transcript: TranscriptPart[];
}

export function projectSessionSnapshot(snapshot: SessionSnapshot): SessionProjection {
  return {
    id: snapshot.id,
    name: snapshot.name ?? `Session ${snapshot.id.slice(0, 8)}`,
    cwd: snapshot.cwd,
    model: snapshot.model,
    thinkingLevel: snapshot.thinkingLevel,
    phase: snapshot.phase,
    running: snapshot.phase !== "idle",
    queuedSteerCount: snapshot.queuedSteerCount,
    updatedAt: snapshot.updatedAt,
    transcript: projectTranscript(snapshot.transcript),
  };
}
