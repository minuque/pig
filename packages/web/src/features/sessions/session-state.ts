import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import { routeRunEvent, type UiRun } from "../runs/run-state.js";

export const clampPanelWidth = (width: number) => Math.min(420, Math.max(240, width));

export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = 80,
) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export interface SessionClientState {
  draft: string;
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
  runs: Map<string, UiRun>;
}

export const sessionKey = (workspaceId: string, sessionId: string) => `${workspaceId}:${sessionId}`;

export function sessionState(
  states: Map<string, SessionClientState>,
  workspaceId: string,
  sessionId: string,
) {
  const key = sessionKey(workspaceId, sessionId);
  let state = states.get(key);
  if (!state) {
    state = { draft: "", scrollTop: 0, following: true, hasNewActivity: false, runs: new Map() };
    states.set(key, state);
  }
  return state;
}

export function routeSessionEvent(
  states: Map<string, SessionClientState>,
  event: SSEEventEnvelope,
) {
  if (!event.workspaceId || !event.sessionId) return;
  const state = sessionState(states, event.workspaceId, event.sessionId);
  const run = routeRunEvent(state.runs, event);
  if (run && !state.following) state.hasNewActivity = true;
  return run;
}
