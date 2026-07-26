import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BootstrapSchema,
  CreateRunSchema,
  endpoints,
  GatewayEventSchema,
  gatewayEventSchemas,
  ModelIdSchema,
  ProblemDetailsSchema,
  RunSummarySchema,
  SessionSnapshotSchema,
  TranscriptItemSchema,
} from "./index.js";

const expectedRoutes = [
  "GET /api/v1/health/live",
  "GET /api/v1/health/ready",
  "POST /api/v1/gateway-auth/bootstrap",
  "GET /api/v1/bootstrap",
  "GET /api/v1/events",
  "POST /api/v1/workspace-registration-previews",
  "GET /api/v1/workspaces",
  "POST /api/v1/workspaces",
  "GET /api/v1/workspaces/:workspaceId",
  "PATCH /api/v1/workspaces/:workspaceId",
  "POST /api/v1/workspaces/:workspaceId/commands/unregister",
  "GET /api/v1/workspaces/:workspaceId/sessions",
  "POST /api/v1/workspaces/:workspaceId/sessions",
  "GET /api/v1/sessions/:sessionId",
  "PATCH /api/v1/sessions/:sessionId",
  "POST /api/v1/sessions/:sessionId/commands/delete",
  "GET /api/v1/sessions/:sessionId/transcript",
  "GET /api/v1/sessions/:sessionId/snapshot",
  "POST /api/v1/sessions/:sessionId/runs",
  "GET /api/v1/runs/:runId",
  "POST /api/v1/runs/:runId/commands/steer",
  "POST /api/v1/runs/:runId/commands/cancel",
  "GET /api/v1/models",
  "GET /api/v1/provider-auth",
  "POST /api/v1/provider-auth/:providerId/commands/set-api-key",
  "POST /api/v1/provider-auth/:providerId/commands/delete-credential",
  "POST /api/v1/provider-auth/:providerId/auth-flows",
  "GET /api/v1/auth-flows/:flowId",
  "POST /api/v1/auth-flows/:flowId/commands/respond",
  "POST /api/v1/auth-flows/:flowId/commands/cancel",
];

const instant = "2025-01-02T03:04:05Z";
const profile = { modelId: "model_1", thinkingLevel: "medium" };
const run = {
  runId: "run_1",
  sessionId: "session_1",
  revision: 2,
  state: "running",
  executionProfile: profile,
  createdAt: instant,
  updatedAt: instant,
};

describe("public contract registry", () => {
  it("declares every v1 and health route exactly once", () => {
    const routes = endpoints.map(({ method, path }) => `${method} ${path}`);
    expect([...routes].sort()).toEqual([...expectedRoutes].sort());
    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(endpoints.map(({ operationId }) => operationId)).size).toBe(endpoints.length);
    expect(new Set(endpoints.map(({ typedClientMethod }) => typedClientMethod)).size).toBe(
      endpoints.length,
    );
  });

  it("gives every operation one authorization class, request/response schemas, and Problem family", () => {
    for (const endpoint of endpoints) {
      expect(["health", "bootstrap", "principal", "workspace"]).toContain(endpoint.authorization);
      expect(endpoint.pathSchema.safeParse({})).toBeDefined();
      expect(endpoint.querySchema.safeParse({})).toBeDefined();
      expect(endpoint.bodySchema.safeParse({})).toBeDefined();
      expect(endpoint.successSchema.safeParse(undefined)).toBeDefined();
      expect(endpoint.problemCodes.length).toBeGreaterThan(0);
    }
  });
});

describe("Pi capability compatibility fixture", () => {
  it("decodes the Pi 0.82.1 bootstrap capability shape", () => {
    const fixture = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../test-fixtures/pi-0.82.1-bootstrap.json", import.meta.url)),
        "utf8",
      ),
    );
    const bootstrap = BootstrapSchema.parse(fixture);
    expect(bootstrap.models[0]?.modelId).toBe("anthropic/claude-sonnet-4-5@20250929");
    expect(bootstrap.models[0]?.thinkingLevels).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
  });

  it("accepts Pi latest-model aliases", () => {
    expect(ModelIdSchema.parse("~anthropic/claude-sonnet-latest")).toBe(
      "~anthropic/claude-sonnet-latest",
    );
  });
});

describe("closed browser-safe schemas", () => {
  it("accepts a frozen run admission and rejects unknown command input", () => {
    expect(
      CreateRunSchema.parse({
        commandId: "command_1",
        prompt: "ship it",
        executionProfile: profile,
      }),
    ).toEqual({
      commandId: "command_1",
      prompt: "ship it",
      executionProfile: profile,
    });
    expect(() =>
      CreateRunSchema.parse({
        commandId: "command_1",
        prompt: "ship it",
        executionProfile: profile,
        piSession: {},
      }),
    ).toThrow();
    expect(() =>
      CreateRunSchema.parse({
        commandId: "command_1",
        prompt: " ",
        executionProfile: profile,
      }),
    ).toThrow();
  });

  it("accepts public resources while projecting away additive response fields", () => {
    expect(RunSummarySchema.parse({ ...run, internalPiState: "secret" })).toEqual(run);
    expect(() => RunSummarySchema.parse({ ...run, revision: -1 })).toThrow();
  });

  it("keeps transcript kinds closed and never accepts raw Pi payloads as a kind", () => {
    expect(
      TranscriptItemSchema.parse({
        entryId: "entry_1",
        createdAt: instant,
        kind: "message",
        role: "assistant",
        text: "done",
      }).kind,
    ).toBe("message");
    expect(() =>
      TranscriptItemSchema.parse({
        entryId: "entry_1",
        createdAt: instant,
        kind: "piRaw",
        payload: { credential: "secret" },
      }),
    ).toThrow();
  });

  it("requires scoped, monotonic event envelopes and rejects unknown event kinds", () => {
    const event = {
      schemaVersion: 1,
      contractRevision: 1,
      gatewayEpoch: "epoch_1",
      gatewaySeq: 4,
      emittedAt: instant,
      workspaceId: "workspace_1",
      sessionId: "session_1",
      runId: "run_1",
      runSeq: 2,
      type: "run.changed",
      payload: run,
    };
    expect(GatewayEventSchema.parse(event).type).toBe("run.changed");
    expect(() => GatewayEventSchema.parse({ ...event, gatewaySeq: 0 })).toThrow();
    expect(() => GatewayEventSchema.parse({ ...event, type: "future.event" })).toThrow();
    expect(Object.keys(gatewayEventSchemas)).toHaveLength(11);
  });

  it("bounds snapshots and rejects incompatible resource revisions", () => {
    const snapshot = {
      session: {
        sessionId: "session_1",
        workspaceId: "workspace_1",
        name: "Session",
        revision: 1,
        availability: "healthy",
        updatedAt: instant,
        createdAt: instant,
      },
      activeRuns: [run],
      queuedRuns: [],
      transcriptTail: [],
      partialOutputs: [],
      capturedEventCursor: "epoch_1:4",
      durableEntryCursor: null,
      historyTruncated: false,
      previousTranscriptCursor: null,
    };
    expect(SessionSnapshotSchema.parse(snapshot).activeRuns).toHaveLength(1);
    expect(() =>
      SessionSnapshotSchema.parse({
        ...snapshot,
        activeRuns: [run, { ...run, runId: "run_2" }],
      }),
    ).toThrow();
  });

  it("accepts RFC 9457 Problems and rejects unknown stable codes", () => {
    const problem = {
      type: "https://errors.local/run/queue-full",
      title: "Queue full",
      status: 429,
      detail: "Try another Session.",
      instance: "/api/v1/sessions/session_1/runs",
      code: "run.queue_full",
      requestId: "request_1",
      retryable: true,
    };
    expect(ProblemDetailsSchema.parse(problem).code).toBe("run.queue_full");
    expect(() => ProblemDetailsSchema.parse({ ...problem, code: "run.made_up" })).toThrow();
  });
});
