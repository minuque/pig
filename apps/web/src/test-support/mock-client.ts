import type {
  AuthFlow,
  Bootstrap,
  MutationResult,
  ProviderAuthStatus,
  SessionSnapshot,
} from "@no-pi-no-gang/contracts";
import { buildSession } from "@no-pi-no-gang/testkit";
import { vi } from "vitest";
import type { WebGatewayClient } from "@/lib/gateway/client";

/**
 * Shared Gateway client stub for component tests. Every method is a vi.fn
 * with a safe default; tests override behaviour via vi.mocked(...). The cast
 * to WebGatewayClient is deliberate: defaults only cover what component
 * tests exercise.
 */
export function mockMutationResult<T>(result: T): MutationResult<T> {
  return {
    receipt: {
      commandId: "cmd_1",
      disposition: "applied",
      acceptedAt: "2025-01-02T03:04:05.000Z",
    },
    result,
  } as MutationResult<T>;
}

export const mockBootstrap = {
  gatewayBuildId: "test-build",
  principal: { principalId: "principal_1", displayName: "Test User" },
  contractRevision: 1,
  minClientRevision: 1,
  csrfToken: "c".repeat(32),
  capabilities: {
    maxPageSize: 100,
    defaultPageSize: 25,
    maxQueuedRunsPerSession: 32,
    maxActiveRuns: 4,
    features: {},
  },
  models: [],
  providerAuth: [],
  nonterminalRuns: [],
  capturedEventCursor: "epoch_1:1",
} as unknown as Bootstrap;

export function mockProviderAuth(overrides: Partial<ProviderAuthStatus> = {}): ProviderAuthStatus {
  return {
    providerId: "anthropic",
    revision: 1,
    state: "required",
    methods: ["apiKey", "authFlow"],
    ...overrides,
  } as ProviderAuthStatus;
}

export function mockAuthFlow(overrides: Partial<AuthFlow> = {}): AuthFlow {
  return {
    flowId: "flow_1",
    providerId: "anthropic",
    revision: 1,
    state: "pending",
    expiresAt: "2025-01-02T04:04:05.000Z",
    ...overrides,
  } as AuthFlow;
}

export function mockSessionSnapshot(): SessionSnapshot {
  return {
    session: buildSession(),
    activeRuns: [],
    queuedRuns: [],
    transcriptTail: [],
    partialOutputs: [],
    capturedEventCursor: "epoch_1:1",
    durableEntryCursor: null,
    historyTruncated: false,
    previousTranscriptCursor: null,
  } as unknown as SessionSnapshot;
}

export function createMockGatewayClient(): WebGatewayClient {
  return {
    health: {
      live: vi.fn(async () => ({ status: "live" as const })),
      ready: vi.fn(async () => ({ status: "ready" as const })),
    },
    gatewayAuth: {
      bootstrap: vi.fn(async () => ({ csrfToken: "c".repeat(32) })),
    },
    bootstrap: { get: vi.fn(async () => mockBootstrap) },
    workspaces: {
      preview: vi.fn(),
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
    },
    sessions: {
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transcript: vi.fn(async () => ({ items: [], nextCursor: null })),
      snapshot: vi.fn(async () => mockSessionSnapshot()),
    },
    runs: {
      create: vi.fn(),
      get: vi.fn(),
      steer: vi.fn(),
      cancel: vi.fn(),
    },
    models: { list: vi.fn(async () => []) },
    providerAuth: {
      list: vi.fn(async () => []),
      setApiKey: vi.fn(),
      deleteCredential: vi.fn(),
    },
    authFlows: {
      create: vi.fn(),
      get: vi.fn(),
      respond: vi.fn(),
      cancel: vi.fn(),
    },
    events: {
      open: vi.fn(async function* () {
        // Never yields; component tests do not consume the stream.
      }),
    },
  } as unknown as WebGatewayClient;
}
