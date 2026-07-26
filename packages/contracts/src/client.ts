import type { AuthFlow, Model, ProviderAuthStatus } from "./model-auth.js";
import type { Bootstrap } from "./bootstrap.js";
import type { CursorPage, MutationResult, Revision } from "./common.js";
import type {
  AuthFlowId,
  CommandId,
  EventCursor,
  ModelId,
  OpaqueCursor,
  ProviderId,
  RunId,
  SessionId,
  WorkspaceId,
} from "./ids.js";
import type { RunDetail, RunSummary, ThinkingLevel } from "./run.js";
import type {
  SessionDetail,
  SessionSnapshot,
  SessionSummary,
} from "./session.js";
import type { GatewayStreamItem } from "./events.js";
import type { TranscriptItem } from "./transcript.js";
import type {
  WorkspaceDetail,
  WorkspaceRegistrationPreview,
  WorkspaceSummary,
} from "./workspace.js";

interface PageInput {
  cursor?: OpaqueCursor;
  limit?: number;
}
interface CommandInput {
  commandId: CommandId;
}
interface RevisionCommandInput extends CommandInput {
  expectedRevision: Revision;
}

export interface GatewayClient {
  health: {
    live(): Promise<{ status: "live" }>;
    ready(): Promise<{
      status:
        | "ready"
        | "starting"
        | "migrating"
        | "reconciling"
        | "shutting_down"
        | "unavailable";
    }>;
  };
  gatewayAuth: {
    bootstrap(input: { secret: string }): Promise<{ csrfToken: string }>;
  };
  bootstrap: { get(): Promise<Bootstrap> };
  workspaces: {
    preview(
      input: CommandInput & { candidatePath: string },
    ): Promise<MutationResult<WorkspaceRegistrationPreview>>;
    list(input?: PageInput): Promise<CursorPage<WorkspaceSummary>>;
    create(
      input: CommandInput & { previewId: string; name: string },
    ): Promise<MutationResult<WorkspaceDetail>>;
    get(input: { workspaceId: WorkspaceId }): Promise<WorkspaceDetail>;
    update(
      input: { workspaceId: WorkspaceId; name: string } & RevisionCommandInput,
    ): Promise<MutationResult<WorkspaceDetail>>;
    unregister(
      input: { workspaceId: WorkspaceId } & RevisionCommandInput,
    ): Promise<MutationResult<WorkspaceSummary>>;
  };
  sessions: {
    list(
      input: { workspaceId: WorkspaceId; search?: string } & PageInput,
    ): Promise<CursorPage<SessionSummary>>;
    create(
      input: { workspaceId: WorkspaceId; name: string } & CommandInput,
    ): Promise<MutationResult<SessionDetail>>;
    get(input: { sessionId: SessionId }): Promise<SessionDetail>;
    update(
      input: { sessionId: SessionId; name: string } & RevisionCommandInput,
    ): Promise<MutationResult<SessionDetail>>;
    delete(
      input: { sessionId: SessionId } & RevisionCommandInput,
    ): Promise<MutationResult<SessionSummary>>;
    transcript(
      input: { sessionId: SessionId } & PageInput,
    ): Promise<CursorPage<TranscriptItem>>;
    snapshot(input: { sessionId: SessionId }): Promise<SessionSnapshot>;
  };
  runs: {
    create(input: {
      sessionId: SessionId;
      commandId: CommandId;
      prompt: string;
      executionProfile: {
        modelId: ModelId;
        thinkingLevel: ThinkingLevel;
      };
      retryOfRunId?: RunId;
    }): Promise<MutationResult<RunSummary>>;
    get(input: { runId: RunId }): Promise<RunDetail>;
    steer(
      input: { runId: RunId; instruction: string } & CommandInput,
    ): Promise<MutationResult<RunSummary>>;
    cancel(
      input: { runId: RunId } & CommandInput,
    ): Promise<MutationResult<RunSummary>>;
  };
  models: { list(): Promise<Model[]> };
  providerAuth: {
    list(): Promise<ProviderAuthStatus[]>;
    setApiKey(
      input: { providerId: ProviderId; apiKey: string } & CommandInput,
    ): Promise<MutationResult<ProviderAuthStatus>>;
    deleteCredential(
      input: { providerId: ProviderId } & CommandInput,
    ): Promise<MutationResult<ProviderAuthStatus>>;
  };
  authFlows: {
    create(
      input: { providerId: ProviderId } & CommandInput,
    ): Promise<MutationResult<AuthFlow>>;
    get(input: { flowId: AuthFlowId }): Promise<AuthFlow>;
    respond(
      input: {
        flowId: AuthFlowId;
        promptId: string;
        response: string;
      } & CommandInput,
    ): Promise<MutationResult<AuthFlow>>;
    cancel(
      input: { flowId: AuthFlowId } & CommandInput,
    ): Promise<MutationResult<AuthFlow>>;
  };
  events: {
    open(
      input: { after?: EventCursor },
      options?: { signal?: AbortSignal },
    ): AsyncIterable<GatewayStreamItem>;
  };
}

export type GatewayClientErrorKind =
  "problem" | "network" | "decode" | "protocol" | "aborted";
