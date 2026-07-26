import type {
  AuthFlowId,
  RunId,
  SessionId,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";

/**
 * Sole constructor of Vue Query cache keys. Every request-affecting identity
 * and filter participates in the key.
 */
export const gatewayKeys = {
  bootstrap: ["bootstrap"] as const,
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...gatewayKeys.workspaces.all, "list"] as const,
    detail: (workspaceId: WorkspaceId) =>
      [...gatewayKeys.workspaces.all, "detail", workspaceId] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    list: (workspaceId: WorkspaceId, search: string) =>
      [...gatewayKeys.sessions.all, "list", workspaceId, search] as const,
    detail: (sessionId: SessionId) =>
      [...gatewayKeys.sessions.all, "detail", sessionId] as const,
    transcript: (sessionId: SessionId) =>
      [...gatewayKeys.sessions.all, "transcript", sessionId] as const,
    snapshot: (sessionId: SessionId) =>
      [...gatewayKeys.sessions.all, "snapshot", sessionId] as const,
    runs: (sessionId: SessionId) =>
      [...gatewayKeys.sessions.all, "runs", sessionId] as const,
  },
  runs: {
    detail: (runId: RunId) => ["runs", "detail", runId] as const,
  },
  models: ["models"] as const,
  providerAuth: ["provider-auth"] as const,
  authFlow: (flowId: AuthFlowId) => ["auth-flows", flowId] as const,
};
