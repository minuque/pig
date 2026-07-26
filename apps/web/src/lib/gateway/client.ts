import type { z } from "zod";
import {
  AuthFlowSchema,
  BootstrapExchangeResultSchema,
  BootstrapSchema,
  LiveHealthSchema,
  ModelSchema,
  ProblemDetailsSchema,
  ProviderAuthStatusSchema,
  ReadyHealthSchema,
  RunDetailSchema,
  RunSummarySchema,
  SessionDetailSchema,
  SessionSnapshotSchema,
  SessionSummarySchema,
  TranscriptPageSchema,
  WorkspaceDetailSchema,
  WorkspaceRegistrationPreviewSchema,
  WorkspaceSummarySchema,
  cursorPageSchema,
  mutationResultSchema,
  type GatewayClient,
  type MutationResult,
  type OpaqueCursor,
} from "@no-pi-no-gang/contracts";
import { getCsrfToken } from "@/lib/gateway/csrf";
import { GatewayRequestError } from "@/lib/gateway/errors";
import { openEventStream, type WebStreamItem } from "@/lib/gateway/sse";

export interface CallOptions {
  signal?: AbortSignal;
}

type ClientEvents = {
  open(
    input: Parameters<GatewayClient["events"]["open"]>[0],
    options?: { signal?: AbortSignal },
  ): AsyncIterable<WebStreamItem>;
};

/** Contract client whose event stream may also carry unknown future events. */
export type WebGatewayClient = Omit<GatewayClient, "events"> & {
  events: ClientEvents;
};

interface RequestInput {
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  mutation?: boolean;
  signal?: AbortSignal | undefined;
}

async function request<T>(input: RequestInput, schema: z.ZodType<T>): Promise<T> {
  const url = new URL(input.path, window.location.origin);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (input.body !== undefined) headers["content-type"] = "application/json";
  if (input.mutation) {
    const csrf = getCsrfToken();
    if (csrf) headers["x-csrf-token"] = csrf;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      headers,
      body: input.body === undefined ? null : JSON.stringify(input.body),
      credentials: "same-origin",
      signal: input.signal ?? null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GatewayRequestError("aborted", "请求已取消");
    }
    throw new GatewayRequestError("network", "无法连接本地 Gateway");
  }
  let payload: unknown = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new GatewayRequestError(
        "protocol",
        `Gateway 返回了非 JSON 响应（HTTP ${response.status}）`,
      );
    }
  }
  if (!response.ok) {
    const problem = ProblemDetailsSchema.safeParse(payload);
    if (problem.success) throw GatewayRequestError.fromProblem(problem.data);
    throw new GatewayRequestError(
      "protocol",
      `Gateway 返回了无法识别的错误（HTTP ${response.status}）`,
    );
  }
  try {
    return schema.parse(payload);
  } catch {
    throw new GatewayRequestError("decode", "Gateway 响应未通过契约校验");
  }
}

const mutationResult = <T extends z.ZodType>(result: T) => mutationResultSchema(result);

export function createGatewayClient(): WebGatewayClient {
  return {
    health: {
      live: (options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: "/api/v1/health/live",
            signal: options?.signal,
          },
          LiveHealthSchema,
        ),
      ready: (options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: "/api/v1/health/ready",
            signal: options?.signal,
          },
          ReadyHealthSchema,
        ),
    },
    gatewayAuth: {
      bootstrap: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: "/api/v1/gateway-auth/bootstrap",
            body: input,
            signal: options?.signal,
          },
          BootstrapExchangeResultSchema,
        ),
    },
    bootstrap: {
      get: (options?: CallOptions) =>
        request(
          { method: "GET", path: "/api/v1/bootstrap", signal: options?.signal },
          BootstrapSchema,
        ),
    },
    workspaces: {
      preview: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: "/api/v1/workspace-registration-previews",
            body: input,
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(WorkspaceRegistrationPreviewSchema),
        ),
      list: (input?: PageCall) =>
        request(
          {
            method: "GET",
            path: "/api/v1/workspaces",
            query: { cursor: input?.cursor, limit: input?.limit },
            signal: input?.signal,
          },
          cursorPageSchema(WorkspaceSummarySchema),
        ),
      create: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: "/api/v1/workspaces",
            body: input,
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(WorkspaceDetailSchema),
        ),
      get: (input, options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: `/api/v1/workspaces/${input.workspaceId}`,
            signal: options?.signal,
          },
          WorkspaceDetailSchema,
        ),
      update: (input, options?: CallOptions) =>
        request(
          {
            method: "PATCH",
            path: `/api/v1/workspaces/${input.workspaceId}`,
            body: {
              commandId: input.commandId,
              expectedRevision: input.expectedRevision,
              name: input.name,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(WorkspaceDetailSchema),
        ),
      unregister: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/workspaces/${input.workspaceId}/commands/unregister`,
            body: {
              commandId: input.commandId,
              expectedRevision: input.expectedRevision,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(WorkspaceSummarySchema),
        ),
    },
    sessions: {
      list: (input) =>
        request(
          {
            method: "GET",
            path: `/api/v1/workspaces/${input.workspaceId}/sessions`,
            query: {
              cursor: input.cursor,
              limit: input.limit,
              search: input.search === "" ? undefined : input.search,
            },
          },
          cursorPageSchema(SessionSummarySchema),
        ),
      create: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/workspaces/${input.workspaceId}/sessions`,
            body: { commandId: input.commandId, name: input.name },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(SessionDetailSchema),
        ),
      get: (input, options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: `/api/v1/sessions/${input.sessionId}`,
            signal: options?.signal,
          },
          SessionDetailSchema,
        ),
      update: (input, options?: CallOptions) =>
        request(
          {
            method: "PATCH",
            path: `/api/v1/sessions/${input.sessionId}`,
            body: {
              commandId: input.commandId,
              expectedRevision: input.expectedRevision,
              name: input.name,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(SessionDetailSchema),
        ),
      delete: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/sessions/${input.sessionId}/commands/delete`,
            body: {
              commandId: input.commandId,
              expectedRevision: input.expectedRevision,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(SessionSummarySchema),
        ),
      transcript: (input) =>
        request(
          {
            method: "GET",
            path: `/api/v1/sessions/${input.sessionId}/transcript`,
            query: { cursor: input.cursor, limit: input.limit },
          },
          TranscriptPageSchema,
        ),
      snapshot: (input, options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: `/api/v1/sessions/${input.sessionId}/snapshot`,
            signal: options?.signal,
          },
          SessionSnapshotSchema,
        ),
    },
    runs: {
      create: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/sessions/${input.sessionId}/runs`,
            body: {
              commandId: input.commandId,
              prompt: input.prompt,
              executionProfile: input.executionProfile,
              ...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(RunSummarySchema),
        ),
      get: (input, options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: `/api/v1/runs/${input.runId}`,
            signal: options?.signal,
          },
          RunDetailSchema,
        ),
      steer: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/runs/${input.runId}/commands/steer`,
            body: {
              commandId: input.commandId,
              instruction: input.instruction,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(RunSummarySchema),
        ),
      cancel: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/runs/${input.runId}/commands/cancel`,
            body: { commandId: input.commandId },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(RunSummarySchema),
        ),
    },
    models: {
      list: (options?: CallOptions) =>
        request(
          { method: "GET", path: "/api/v1/models", signal: options?.signal },
          ModelSchema.array(),
        ),
    },
    providerAuth: {
      list: (options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: "/api/v1/provider-auth",
            signal: options?.signal,
          },
          ProviderAuthStatusSchema.array(),
        ),
      setApiKey: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/provider-auth/${input.providerId}/commands/set-api-key`,
            body: { commandId: input.commandId, apiKey: input.apiKey },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(ProviderAuthStatusSchema),
        ),
      deleteCredential: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/provider-auth/${input.providerId}/commands/delete-credential`,
            body: { commandId: input.commandId },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(ProviderAuthStatusSchema),
        ),
    },
    authFlows: {
      create: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/provider-auth/${input.providerId}/auth-flows`,
            body: { commandId: input.commandId },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(AuthFlowSchema),
        ),
      get: (input, options?: CallOptions) =>
        request(
          {
            method: "GET",
            path: `/api/v1/auth-flows/${input.flowId}`,
            signal: options?.signal,
          },
          AuthFlowSchema,
        ),
      respond: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/auth-flows/${input.flowId}/commands/respond`,
            body: {
              commandId: input.commandId,
              promptId: input.promptId,
              response: input.response,
            },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(AuthFlowSchema),
        ),
      cancel: (input, options?: CallOptions) =>
        request(
          {
            method: "POST",
            path: `/api/v1/auth-flows/${input.flowId}/commands/cancel`,
            body: { commandId: input.commandId },
            mutation: true,
            signal: options?.signal,
          },
          mutationResult(AuthFlowSchema),
        ),
    },
    events: {
      open: (input, options) =>
        openEventStream({
          after: input.after,
          signal: options?.signal ?? new AbortController().signal,
        }),
    },
  };
}

interface PageCall extends CallOptions {
  cursor?: OpaqueCursor;
  limit?: number;
}
