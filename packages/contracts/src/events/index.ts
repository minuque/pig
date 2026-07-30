import type { RunId, SessionId } from "../resources/index.js";

export const CONTRACT_VERSION = "0.1.0" as const;
export interface SSEEventEnvelope {
  version: string;
  type: string;
  data: unknown;
  sessionId?: SessionId;
  runId?: RunId;
  timestamp?: Date;
}
export interface PiRunEvent {
  type: string;
  data: unknown;
}
