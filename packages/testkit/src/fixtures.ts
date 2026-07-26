import {
  RunSummarySchema,
  SessionDetailSchema,
  WorkspaceDetailSchema,
  type RunSummary,
  type SessionDetail,
  type WorkspaceDetail,
} from "@no-pi-no-gang/contracts";

const instant = "2025-01-02T03:04:05.000Z";

export const buildWorkspace = (
  overrides: Record<string, unknown> = {},
): WorkspaceDetail =>
  WorkspaceDetailSchema.parse({
    workspaceId: "workspace_1",
    name: "Fixture Workspace",
    revision: 1,
    updatedAt: instant,
    canonicalRoot: "/fixture/workspace",
    grantNotice: "Gateway access only; not a filesystem sandbox",
    ...overrides,
  });

export const buildSession = (
  overrides: Record<string, unknown> = {},
): SessionDetail =>
  SessionDetailSchema.parse({
    sessionId: "session_1",
    workspaceId: "workspace_1",
    name: "Fixture Session",
    revision: 1,
    availability: "healthy",
    createdAt: instant,
    updatedAt: instant,
    ...overrides,
  });

export const buildRun = (overrides: Record<string, unknown> = {}): RunSummary =>
  RunSummarySchema.parse({
    runId: "run_1",
    sessionId: "session_1",
    revision: 1,
    state: "queued",
    executionProfile: { modelId: "model_1", thinkingLevel: "medium" },
    createdAt: instant,
    updatedAt: instant,
    ...overrides,
  });
